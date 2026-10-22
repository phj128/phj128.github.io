// Warm nearby previews before hover; play only while requested.
document.querySelectorAll('.paper-media').forEach(media => {
  const video = media.querySelector('video');
  const button = media.querySelector('button');
  if (!video || !button) return;
  const paper = media.closest('.paper');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let pinned = false;
  let requested = false;
  let requestId = 0;

  const preloadObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      video.preload = 'auto';
      preloadObserver.unobserve(media);
    }
  }, { rootMargin: '300px 0px' });
  preloadObserver.observe(media);

  function stop() {
    requestId += 1;
    requested = false;
    video.pause();
    media.classList.remove('is-playing');
    button.textContent = '▶ Demo';
    button.setAttribute('aria-pressed', 'false');
  }

  async function play() {
    if (requested) return;
    const currentRequest = ++requestId;
    requested = true;
    button.textContent = '… Loading';
    button.setAttribute('aria-pressed', 'true');
    try {
      await video.play();
      // A cancelled request must never stop or overwrite a newer hover.
      if (currentRequest !== requestId) return;
      media.classList.add('is-playing');
      button.textContent = 'Ⅱ Pause';
      button.setAttribute('aria-pressed', 'true');
    } catch {
      if (currentRequest !== requestId) return;
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
