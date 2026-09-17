// Temporary helper: list which CSS rules a commit actually changed, ignoring
// reformatting. Produces the review/porting summary for chrome.css.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [baselineRef, file] = process.argv.slice(2);
const original = execFileSync('git', ['show', `${baselineRef}:${file}`], { encoding: 'utf8', maxBuffer: 1 << 28 }).replace(/\r\n/g, '\n');
const current = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

function blocks(css) {
  const out = [];
  let i = 0;
  while (i < css.length) {
    if (/\s/.test(css[i])) { i += 1; continue; }
    const start = i;
    if (css.startsWith('/*', i)) {
      i = css.indexOf('*/', i + 2);
      i = i === -1 ? css.length : i + 2;
      continue; // comments are not rules
    }
    let depth = 0;
    let seenBrace = false;
    while (i < css.length) {
      const ch = css[i];
      if (ch === '{') { depth += 1; seenBrace = true; }
      else if (ch === '}') { depth -= 1; if (depth === 0) { i += 1; break; } }
      else if (!seenBrace && ch === ';' && depth === 0) { i += 1; break; }
      i += 1;
    }
    const text = css.slice(start, i);
    out.push({ selector: text.split('{')[0].replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim(), text });
  }
  return out;
}

const normalise = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').replace(/\s*([{};,])\s*/g, '$1').replace(/;}/g, '}').trim();

const originalBlocks = blocks(original);
const currentBlocks = blocks(current);
const originalBySelector = new Map();
originalBlocks.forEach((b) => {
  if (!originalBySelector.has(b.selector)) originalBySelector.set(b.selector, []);
  originalBySelector.get(b.selector).push(normalise(b.text));
});
const currentSelectors = new Set(currentBlocks.map((b) => b.selector));

const added = [];
const changed = [];
for (const block of currentBlocks) {
  const previous = originalBySelector.get(block.selector);
  if (!previous) { added.push(block.selector); continue; }
  if (!previous.includes(normalise(block.text))) changed.push(block.selector);
}
const removed = originalBlocks.map((b) => b.selector).filter((selector) => !currentSelectors.has(selector));

const list = (title, items) => {
  const unique = [...new Set(items)];
  console.log(`\n## ${title} (${unique.length})\n`);
  unique.forEach((selector) => console.log(`- \`${selector.length > 120 ? `${selector.slice(0, 120)}…` : selector}\``));
};

console.log(`# ${file}: what actually changed\n`);
console.log(`Rules: ${originalBlocks.length} before, ${currentBlocks.length} after. Reformatting ignored.`);
list('Added', added);
list('Changed', changed);
list('Removed', removed);
