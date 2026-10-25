/*
 * The Enclosure — Camera FAB → post sheet (E6 + E7).
 *
 * One sheet, two modes:
 *   Note  → POST /feed/note/  {text, client_nonce, race_id?, filter}
 *   Photo → POST /feed/photo/ (multipart: image, caption, client_nonce, race_id?, filter)
 *
 * Both endpoints return the same {ok, entry_id, feed_html, filter,
 * entry_count} shape, so the success path is shared.
 *
 * Lightbox lives in this file too — one tap-target = the photo card
 * in the Feed. Opens the full-size image + optional caption.
 */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function nonce() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return 't' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  function csrfFrom(form) {
    var el = form.querySelector('input[name="csrfmiddlewaretoken"]');
    return el ? el.value : '';
  }

  function initSheet() {
    var sheet = document.getElementById('enc-note-sheet');
    var opener = document.querySelector('[data-role="note-open"]');
    if (!sheet || !opener) return;

    // Note-mode elements
    var noteForm = sheet.querySelector('[data-role="form"]');
    var textarea = sheet.querySelector('[data-role="text"]');
    var counter = sheet.querySelector('[data-role="count"]');
    var noteError = sheet.querySelector('[data-role="error"]');
    var noteSubmit = sheet.querySelector('[data-role="submit"]');

    // Photo-mode elements
    var photoForm = sheet.querySelector('[data-role="photo-form"]');
    var photoFile = sheet.querySelector('[data-role="photo-file"]');
    var photoLabel = sheet.querySelector('[data-role="photo-label"]');
    var photoCaption = sheet.querySelector('[data-role="photo-caption"]');
    var photoStatus = sheet.querySelector('[data-role="photo-count"]');
    var photoError = sheet.querySelector('[data-role="photo-error"]');
    var photoSubmit = sheet.querySelector('[data-role="photo-submit"]');

    var closeBtn = sheet.querySelector('[data-role="close"]');
    var modeButtons = sheet.querySelectorAll('[data-role="mode"]');

    var currentMode = 'note';

    function setMode(mode) {
      currentMode = mode;
      modeButtons.forEach(function (btn) {
        var active = btn.getAttribute('data-mode') === mode;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      if (noteForm)  noteForm.hidden  = (mode !== 'note');
      if (photoForm) photoForm.hidden = (mode !== 'photo');
    }

    function open() {
      sheet.hidden = false;
      document.body.classList.add('enc-sheet-open');
      setMode('note');
      window.setTimeout(function () {
        if (textarea) textarea.focus();
      }, 60);
    }

    function close() {
      sheet.hidden = true;
      document.body.classList.remove('enc-sheet-open');
      if (noteError)  { noteError.hidden = true; noteError.textContent = ''; }
      if (photoError) { photoError.hidden = true; photoError.textContent = ''; }
      opener.focus();
    }

    function updateNoteCount() {
      if (!textarea || !counter) return;
      counter.textContent = textarea.value.length + ' / 500';
    }

    function applySwap(payload) {
      var stream = document.getElementById('enc-feed-stream');
      if (stream && payload && payload.feed_html) {
        stream.innerHTML = payload.feed_html;
      }
    }

    function submitNote(evt) {
      evt.preventDefault();
      var text = (textarea.value || '').trim();
      if (!text) {
        noteError.textContent = 'Add a note first.';
        noteError.hidden = false;
        return;
      }
      noteSubmit.disabled = true;
      noteError.hidden = true;

      var data = new FormData();
      data.append('text', text);
      data.append('client_nonce', nonce());
      var raceId = sheet.getAttribute('data-race-id');
      if (raceId) data.append('race_id', raceId);
      var filter = sheet.getAttribute('data-filter') || 'all';
      data.append('filter', filter);

      fetch(sheet.getAttribute('data-note-endpoint'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRFToken': csrfFrom(noteForm) },
        body: data,
      })
        .then(function (r) { return r.json().then(function (j) { return {status: r.status, body: j}; }); })
        .then(function (res) {
          if (res.status >= 200 && res.status < 300 && res.body.ok) {
            textarea.value = '';
            updateNoteCount();
            applySwap(res.body);
            close();
          } else {
            noteError.textContent = (res.body && res.body.error) || 'Post failed. Try again.';
            noteError.hidden = false;
          }
        })
        .catch(function () {
          noteError.textContent = 'Network error. Try again.';
          noteError.hidden = false;
        })
        .then(function () { noteSubmit.disabled = false; });
    }

    function submitPhoto(evt) {
      evt.preventDefault();
      var file = photoFile.files && photoFile.files[0];
      if (!file) {
        photoError.textContent = 'Pick a photo first.';
        photoError.hidden = false;
        return;
      }
      photoSubmit.disabled = true;
      photoError.hidden = true;
      photoStatus.textContent = 'Uploading…';

      var data = new FormData();
      data.append('image', file);
      var caption = (photoCaption.value || '').trim();
      if (caption) data.append('caption', caption);
      data.append('client_nonce', nonce());
      var raceId = sheet.getAttribute('data-race-id');
      if (raceId) data.append('race_id', raceId);
      var filter = sheet.getAttribute('data-filter') || 'all';
      data.append('filter', filter);

      fetch(sheet.getAttribute('data-photo-endpoint'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRFToken': csrfFrom(photoForm) },
        body: data,
      })
        .then(function (r) { return r.json().then(function (j) { return {status: r.status, body: j}; }); })
        .then(function (res) {
          if (res.status >= 200 && res.status < 300 && res.body.ok) {
            photoFile.value = '';
            photoCaption.value = '';
            photoStatus.textContent = 'Ready when you are';
            if (photoLabel) photoLabel.textContent = 'Tap to take a photo or choose from library';
            applySwap(res.body);
            close();
          } else {
            photoError.textContent = (res.body && res.body.error) || 'Upload failed. Try again.';
            photoError.hidden = false;
            photoStatus.textContent = 'Ready when you are';
          }
        })
        .catch(function () {
          photoError.textContent = 'Network error. Try again.';
          photoError.hidden = false;
          photoStatus.textContent = 'Ready when you are';
        })
        .then(function () { photoSubmit.disabled = false; });
    }

    opener.addEventListener('click', function (e) { e.preventDefault(); open(); });
    closeBtn.addEventListener('click', close);
    sheet.addEventListener('click', function (e) {
      if (e.target === sheet) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !sheet.hidden) close();
    });
    modeButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        setMode(btn.getAttribute('data-mode'));
      });
    });
    if (textarea) textarea.addEventListener('input', updateNoteCount);
    if (noteForm) noteForm.addEventListener('submit', submitNote);
    if (photoForm) photoForm.addEventListener('submit', submitPhoto);
    if (photoFile) {
      photoFile.addEventListener('change', function () {
        var f = photoFile.files && photoFile.files[0];
        if (f && photoLabel) {
          photoLabel.textContent = f.name + ' (' + Math.round(f.size / 1024) + ' KB)';
        }
      });
    }
    updateNoteCount();
  }

  function initLightbox() {
    var box = document.getElementById('enc-lightbox');
    if (!box) return;
    var img = box.querySelector('[data-role="lightbox-img"]');
    var cap = box.querySelector('[data-role="lightbox-caption"]');
    var closeBtn = box.querySelector('[data-role="lightbox-close"]');

    function open(src, alt, caption) {
      img.src = src;
      img.alt = alt || 'Guest photo';
      if (caption) {
        cap.textContent = caption;
        cap.hidden = false;
      } else {
        cap.hidden = true;
        cap.textContent = '';
      }
      box.hidden = false;
      document.body.classList.add('enc-lightbox-open');
    }

    function close() {
      box.hidden = true;
      img.src = '';
      document.body.classList.remove('enc-lightbox-open');
    }

    // Event delegation on the document so photos in swapped-in
    // feed HTML fragments are still tap-able without rebinding.
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest && e.target.closest('[data-role="photo-lightbox"]');
      if (!trigger) return;
      e.preventDefault();
      open(
        trigger.getAttribute('data-photo-src'),
        trigger.querySelector('img') ? trigger.querySelector('img').alt : '',
        trigger.getAttribute('data-photo-caption'),
      );
    });

    closeBtn.addEventListener('click', close);
    box.addEventListener('click', function (e) {
      // Tap outside the img to close.
      if (e.target === box) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !box.hidden) close();
    });
  }

  ready(function () {
    initSheet();
    initLightbox();
  });
})();
