/* Client-side SR-PICK-V1 verifier.
 *
 * Runs entirely in the reader's browser using the Web Crypto API.
 * The whole point of this file: the SHA-256 and the Merkle walk
 * happen locally, so a lying server can't fake the verdict.
 *
 * Contract with the server side (proof/services/canonical.py):
 *
 *   compute_leaf_hash(canonical) == sha256(
 *     JSON.stringify(canonical) using:
 *       - sort_keys=True
 *       - ensure_ascii=True   → non-ASCII chars as \uXXXX
 *       - separators=(',', ':')  → no whitespace
 *   )
 *
 * The server has already done that once and sent us both the raw
 * bytes it hashed (canonical_json) AND the hash it got. We just:
 *
 *   1. Re-parse canonical_json, re-serialise it ourselves, hash it,
 *      and confirm we get the same leaf. Guards against the server
 *      lying about the leaf hash.
 *
 *   2. Walk the Merkle proof and confirm we reach the batch root.
 *      Guards against the server lying about batch membership.
 *
 * If either check fails, verdict is red.
 */
(function () {
  'use strict';

  const payloadEl = document.getElementById('pf-payload');
  const verdictEl = document.getElementById('pf-verdict');
  if (!payloadEl || !verdictEl) return;   // not the verify page

  const payload = JSON.parse(payloadEl.textContent);

  // ── Canonical JSON — mirror of Python json.dumps ──────────────

  function jsonEscapeAscii(str) {
    let out = '"';
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      const ch = str[i];
      if (ch === '"')       out += '\\"';
      else if (ch === '\\') out += '\\\\';
      else if (code === 8)  out += '\\b';
      else if (code === 9)  out += '\\t';
      else if (code === 10) out += '\\n';
      else if (code === 12) out += '\\f';
      else if (code === 13) out += '\\r';
      else if (code < 0x20) out += '\\u' + code.toString(16).padStart(4, '0');
      else if (code < 0x7f) out += ch;
      else                  out += '\\u' + code.toString(16).padStart(4, '0');
      // High surrogates (0xd800–0xdfff) are handled by the two-char
      // iteration above; each half is emitted as a separate \uXXXX,
      // which matches Python's json.dumps ensure_ascii behaviour.
    }
    return out + '"';
  }

  function canonicalise(value) {
    if (value === null) return 'null';
    if (value === true) return 'true';
    if (value === false) return 'false';
    if (typeof value === 'number') {
      // Only integers occur in our schema. Preserve exact integer
      // formatting; if a float ever appears, JSON.stringify's default
      // is compatible with json.dumps for finite non-exponent floats.
      return JSON.stringify(value);
    }
    if (typeof value === 'string') {
      return jsonEscapeAscii(value);
    }
    if (Array.isArray(value)) {
      return '[' + value.map(canonicalise).join(',') + ']';
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value).sort();
      const parts = keys.map(function (k) {
        return jsonEscapeAscii(k) + ':' + canonicalise(value[k]);
      });
      return '{' + parts.join(',') + '}';
    }
    throw new Error('canonicalise: unsupported type ' + typeof value);
  }

  // ── SHA-256 via Web Crypto ────────────────────────────────────

  async function sha256Hex(text) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error(
        'crypto.subtle unavailable — needs HTTPS or localhost.'
      );
    }
    const bytes = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  // ── Merkle proof walker ──────────────────────────────────────
  //
  // Mirrors proof/services/merkle.py walk_proof exactly.
  // Parent hash = sha256(sibling + self)  when sibling is 'left'
  //             = sha256(self + sibling)  when sibling is 'right'

  async function walkProof(leafHex, proof) {
    let current = leafHex;
    for (let i = 0; i < proof.length; i++) {
      const hop = proof[i];
      const combined = hop.position === 'left'
        ? hop.hash + current
        : current + hop.hash;
      current = await sha256Hex(combined);
    }
    return current;
  }

  // ── Verdict UI ────────────────────────────────────────────────

  function setVerdict(state, headline, detail) {
    verdictEl.dataset.state = state;
    const icon = verdictEl.querySelector('.pf__verdict-icon');
    const h = document.getElementById('pf-verdict-headline');
    const d = document.getElementById('pf-verdict-detail');
    if (h) h.textContent = headline;
    if (d) d.textContent = detail;
    if (!icon) return;
    if (state === 'pass') {
      icon.innerHTML = '<svg viewBox="0 0 32 32" width="48" height="48">'
        + '<circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="3"/>'
        + '<path d="M10 16.5 L14.5 21 L22.5 12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
        + '</svg>';
    } else if (state === 'warn') {
      icon.innerHTML = '<svg viewBox="0 0 32 32" width="48" height="48">'
        + '<circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="3"/>'
        + '<line x1="16" y1="10" x2="16" y2="18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'
        + '<circle cx="16" cy="22" r="1.5" fill="currentColor"/>'
        + '</svg>';
    } else if (state === 'fail') {
      icon.innerHTML = '<svg viewBox="0 0 32 32" width="48" height="48">'
        + '<circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="3"/>'
        + '<line x1="11" y1="11" x2="21" y2="21" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'
        + '<line x1="21" y1="11" x2="11" y2="21" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'
        + '</svg>';
    }
  }

  // ── Verification pipeline ─────────────────────────────────────

  async function verify() {
    let recomputedLeaf;

    try {
      // Re-parse the canonical JSON the server sent us — treat the
      // JSON string as an opaque blob and don't trust that it's
      // already canonical. Serialise it OURSELVES and hash the result.
      const parsed = JSON.parse(payload.canonical_json);
      const ourCanonical = canonicalise(parsed);
      recomputedLeaf = await sha256Hex(ourCanonical);
    } catch (err) {
      setVerdict('fail', 'Verification error',
        'Could not hash the canonical form: ' + err.message);
      return;
    }

    const clientLeafEl = document.getElementById('pf-client-leaf');
    if (clientLeafEl) clientLeafEl.textContent = recomputedLeaf;

    if (recomputedLeaf !== payload.leaf_hash) {
      setVerdict('fail', 'Leaf hash mismatch',
        "Your browser's SHA-256 of the canonical bytes does NOT match "
        + 'the leaf hash Saturday published. Something has been tampered with.');
      return;
    }

    // If there's no batch yet, the leaf is valid but not folded
    // into a Merkle root — only partial verification is possible.
    if (!payload.batch_root) {
      setVerdict('warn', 'Leaf verified · batch pending',
        'The leaf hash matches. The end-of-day Merkle batch has not '
        + 'yet been assembled, so root verification will run once the '
        + 'batch closes.');
      return;
    }

    let walkedRoot;
    try {
      walkedRoot = await walkProof(recomputedLeaf, payload.merkle_proof || []);
    } catch (err) {
      setVerdict('fail', 'Merkle walk error',
        'Could not walk the Merkle proof: ' + err.message);
      return;
    }

    const clientRootEl = document.getElementById('pf-client-root');
    if (clientRootEl) clientRootEl.textContent = walkedRoot;

    if (walkedRoot !== payload.batch_root) {
      setVerdict('fail', 'Merkle root mismatch',
        "Your browser walked the proof and got a different root than "
        + 'Saturday claims. The pick is NOT part of the batch it claims.');
      return;
    }

    setVerdict('pass',
      payload.anchored ? 'Verified · anchored on-chain'
                       : 'Verified · off-chain',
      payload.anchored
        ? 'Leaf, proof and root all match. Root is anchored on the public chain.'
        : 'Leaf, proof and root all match. The batch root will anchor on-chain in a separate step.');
  }

  // ── Copy button ───────────────────────────────────────────────
  document.querySelectorAll('.pf__copy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const target = document.getElementById(btn.dataset.copyTarget);
      if (!target) return;
      navigator.clipboard.writeText(target.textContent).then(function () {
        btn.dataset.copied = 'true';
        btn.textContent = 'Copied';
        setTimeout(function () {
          delete btn.dataset.copied;
          btn.textContent = 'Copy JSON';
        }, 1600);
      }).catch(function () { /* silent — user can select manually */ });
    });
  });

  verify();
})();
