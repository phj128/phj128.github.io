// Preview URLs stay in data-src until the visitor asks to play them.
let activePreview = null;

document.querySelectorAll('.paper-media').forEach(media => {
  const video = media.querySelector('video');
  const button = media.querySelector('button');
  if (!video || !button) return;
  const paper = media.closest('.paper');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let requested = false;
  let requestId = 0;
  let loadingTimer;
  let bufferedUntil = 0;
  const preview = { stop };

  function stop() {
    requestId += 1;
    requested = false;
    clearTimeout(loadingTimer);
    video.pause();
    media.classList.remove('is-playing');
    button.textContent = '▶ Demo';
    button.setAttribute('aria-pressed', 'false');
    button.removeAttribute('title');
    if (activePreview === preview) activePreview = null;

    // Keep fully buffered clips ready to replay; abort incomplete downloads.
    const complete = Number.isFinite(video.duration) && video.buffered.length > 0 &&
      video.buffered.start(0) === 0 &&
      video.buffered.end(video.buffered.length - 1) >= video.duration - 0.05;
    if (!complete && video.hasAttribute('src')) {
      video.removeAttribute('src');
      video.load();
    }
  }

  function retry() {
    stop();
    button.textContent = '↻ Retry';
    button.title = 'Video could not start. Click to retry.';
  }

  function watchLoading(currentRequest) {
    clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => {
      if (currentRequest === requestId && requested) retry();
    }, 20000);
  }

  video.addEventListener('progress', () => {
    if (!requested || media.classList.contains('is-playing')) return;
    const end = video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0;
    if (end > bufferedUntil) {
      bufferedUntil = end;
      watchLoading(requestId);
    }
  });

  async function play() {
    if (requested) return;
    if (activePreview && activePreview !== preview) activePreview.stop();
    activePreview = preview;
    const currentRequest = ++requestId;
    requested = true;
    bufferedUntil = 0;
    button.textContent = '… Loading';
    button.setAttribute('aria-pressed', 'true');
    button.removeAttribute('title');
    if (!video.hasAttribute('src')) video.src = video.dataset.src;
    watchLoading(currentRequest);
    try {
      await video.play();
      // An interrupted play promise must not overwrite a newer request.
      if (currentRequest !== requestId) return;
      clearTimeout(loadingTimer);
      media.classList.add('is-playing');
      button.textContent = 'Ⅱ Pause';
    } catch {
      if (currentRequest === requestId) retry();
    }
  }

  paper.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse' && !reducedMotion.matches) play();
  });
  paper.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse') stop();
  });
  button.addEventListener('click', () => { if (requested) stop(); else play(); });
  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) stop();
  }).observe(media);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });
});
