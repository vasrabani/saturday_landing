/* fox-challenge.js — the "Challenge me, Cubs" onboarding step.

   Identical in saturday_landing (static/public/js/) and Django
   (public/static/public/v2/js/).

   A "Pick your horse" link marked data-fox-challenge opens the one
   #foxChallenge dialog instead of going straight to the featured race.
   The dialog takes the featured race from the link that opened it:
     href            -> where "Featured race" goes (the link's own target)
     data-fox-race   -> the line under it, e.g. "13:37 Exeter"
   so each page keeps its single source for both, and the dialog never
   has to know which race is featured.

   Without JS, or in a browser with no <dialog>, the link goes where its
   href says, exactly as before: the step is never a dead end. Clicks
   meant for a new tab (ctrl/cmd/shift, middle button) go straight
   through too. */
(function () {
  var dialog = document.getElementById('foxChallenge');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  var featured = dialog.querySelector('[data-fox-challenge-featured]');
  var featuredMeta = dialog.querySelector('[data-fox-challenge-race]');
  var defaultMeta = featuredMeta ? featuredMeta.textContent : '';

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest && e.target.closest('a[data-fox-challenge]');
    if (!trigger || e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    e.preventDefault();
    if (featured) featured.href = trigger.href;
    if (featuredMeta) {
      var race = (trigger.getAttribute('data-fox-race') || '').trim();
      featuredMeta.textContent = race || defaultMeta;
    }
    dialog.showModal();
  });

  // A tap on the dimmed backdrop closes it, as Escape and the ✕ do. The
  // backdrop's clicks land on the dialog element itself, outside its box.
  dialog.addEventListener('click', function (e) {
    if (e.target !== dialog) return;
    var r = dialog.getBoundingClientRect();
    var inside = e.clientX >= r.left && e.clientX <= r.right &&
                 e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) dialog.close();
  });
})();
