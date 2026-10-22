// Load and play a preview only while the visitor is interacting with it.
document.querySelectorAll('.paper-media').forEach(media => {
  const video = media.querySelector('video');
  const button = media.querySelector('button');
  if (!video || !button) return;
  const paper = media.closest('.paper');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let pinned = false;
  let requested = false;

  function stop() {
    requested = false;
    video.pause();
    media.classList.remove('is-playing');
    button.textContent = '▶ Demo';
    button.setAttribute('aria-pressed', 'false');
  }

  async function play() {
    requested = true;
    try {
      await video.play();
      if (!requested) { video.pause(); return; }
      media.classList.add('is-playing');
      button.textContent = 'Ⅱ Pause';
      button.setAttribute('aria-pressed', 'true');
    } catch {
      pinned = false;
      stop();
    }
  }

  paper.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse' && !reducedMotion.matches) play();
  });
  paper.addEventListener('pointerleave', () => { if (!pinned) stop(); });
  button.addEventListener('click', () => {
    if (requested) { pinned = false; stop(); }
    else { pinned = true; play(); }
  });
  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) { pinned = false; stop(); }
  }).observe(media);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pinned = false; stop(); }
  });
});
