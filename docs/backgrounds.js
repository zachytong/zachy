(() => {
  const scene = document.getElementById('background-scene');
  const toggle = document.getElementById('background-toggle');
  const nextButton = document.getElementById('background-next');
  const credit = document.getElementById('background-credit');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let enabled = Blog.read('blog-backgrounds-enabled', reducedMotion.matches ? 'off' : 'on') === 'on';
  let items = [], intervalSeconds = 30, currentIndex = -1, generation = 0;
  let currentLayer = null, incomingLayer = null, rotationTimer, enabledBeforeView = enabled;

  function labels() {
    const zh = Blog.lang === 'zh';
    document.body.dataset.backgroundAvailable = String(items.length > 0);
    credit.hidden = !enabled || !currentLayer;
    document.getElementById('background-credit-label').textContent = zh ? '图源' : 'Image source';
    toggle.hidden = !items.length;
    nextButton.hidden = !enabled || items.length < 2;
    toggle.title = enabled ? (zh ? '隐藏背景' : 'Hide background') : (zh ? '显示背景' : 'Show background');
    toggle.setAttribute('aria-label', toggle.title);
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.innerHTML = Blog.icon(enabled ? 'image-off' : 'image');
    nextButton.title = zh ? '下一张背景' : 'Next background';
    nextButton.setAttribute('aria-label', nextButton.title);
    Blog.icons();
    document.dispatchEvent(new Event('blog:backgrounds-change'));
  }

  function dispose(layer) {
    if (!layer) return;
    const video = layer.querySelector('video');
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    layer.remove();
  }

  function schedule() {
    clearTimeout(rotationTimer);
    if (enabled && items.length > 1 && !document.hidden) rotationTimer = setTimeout(() => show((currentIndex + 1) % items.length), intervalSeconds * 1000);
  }

  function hide() {
    generation++;
    clearTimeout(rotationTimer);
    dispose(incomingLayer); dispose(currentLayer);
    incomingLayer = null; currentLayer = null;
    for (const layer of [...scene.children]) dispose(layer);
    document.body.classList.remove('has-background');
    labels();
  }

  async function show(index, attempt = 0) {
    if (!enabled || !items.length || document.hidden) return;
    const token = ++generation;
    clearTimeout(rotationTimer);
    dispose(incomingLayer);
    const item = items[index];
    const layer = document.createElement('div');
    layer.className = 'background-layer';
    layer.dataset.source = item.url;
    const media = document.createElement(item.type === 'video' ? 'video' : 'img');
    if (item.type === 'video') {
      media.muted = true;
      media.autoplay = true;
      media.playsInline = true;
      media.loop = items.length === 1;
      media.preload = 'auto';
      media.disablePictureInPicture = true;
      media.setAttribute('playsinline', '');
    } else media.alt = '';
    layer.append(media);
    incomingLayer = layer;
    scene.append(layer);
    let timeout;
    const ready = new Promise((resolve, reject) => {
      media.addEventListener(item.type === 'video' ? 'loadeddata' : 'load', resolve, { once: true });
      media.addEventListener('error', reject, { once: true });
      timeout = setTimeout(reject, 12000);
    });
    media.src = item.url;
    try { await ready; }
    catch {
      if (token !== generation) return;
      dispose(layer); incomingLayer = null;
      if (attempt + 1 < items.length) show((index + 1) % items.length, attempt + 1);
      else if (!currentLayer) document.body.classList.remove('has-background');
      return;
    } finally { clearTimeout(timeout); }
    if (token !== generation || !enabled) { dispose(layer); return; }
    const oldLayer = currentLayer;
    currentLayer = layer; incomingLayer = null; currentIndex = index;
    document.body.classList.add('has-background');
    requestAnimationFrame(() => layer.classList.add('is-active'));
    if (oldLayer) {
      oldLayer.classList.remove('is-active');
      setTimeout(() => { if (oldLayer !== currentLayer) dispose(oldLayer); }, 1100);
    }
    if (item.type === 'video') {
      media.play().catch(() => {});
      media.addEventListener('ended', () => { if (currentLayer === layer && items.length > 1) show((currentIndex + 1) % items.length); });
    }
    schedule(); labels();
  }

  async function refresh() {
    try {
      const response = await fetch('backgrounds.json', { cache: 'no-store' });
      if (!response.ok) return;
      const manifest = await response.json();
      const directory = new URL('backgrounds/', location.href);
      const nextItems = Array.isArray(manifest.items) ? manifest.items.filter(item => {
        if (typeof item.url !== 'string' || !['video', 'image'].includes(item.type)) return false;
        const url = new URL(item.url, location.href);
        return url.origin === directory.origin && url.pathname.startsWith(directory.pathname);
      }) : [];
      const interval = Number(manifest.intervalSeconds);
      const nextInterval = Number.isFinite(interval) ? Math.max(5, Math.min(3600, interval)) : 30;
      const changed = JSON.stringify(nextItems) !== JSON.stringify(items) || nextInterval !== intervalSeconds;
      items = nextItems; intervalSeconds = nextInterval;
      if (!items.length) hide();
      else if (enabled && (!currentLayer || changed)) {
        const index = items.findIndex(item => item.url === currentLayer?.dataset.source);
        currentIndex = index;
        show(index < 0 ? 0 : index);
      }
      labels();
    } catch { /* Keep the current background if a manifest refresh fails. */ }
  }

  toggle.onclick = () => {
    enabled = !enabled;
    Blog.write('blog-backgrounds-enabled', enabled ? 'on' : 'off');
    if (enabled) show(Math.max(0, currentIndex)); else hide();
    labels();
  };
  nextButton.onclick = () => show((currentIndex + 1) % items.length);
  document.addEventListener('blog:render', labels);
  document.addEventListener('blog:background-view', event => {
    if (event.detail.active) {
      enabledBeforeView = enabled; enabled = true;
      if (!currentLayer) show(Math.max(0, currentIndex));
    } else {
      enabled = enabledBeforeView;
      if (!enabled) hide();
    }
    labels();
  });
  document.addEventListener('visibilitychange', () => {
    const video = currentLayer?.querySelector('video');
    if (document.hidden) { clearTimeout(rotationTimer); video?.pause(); }
    else if (enabled && !currentLayer) show(Math.max(0, currentIndex));
    else if (enabled) { video?.play().catch(() => {}); schedule(); }
  });
  refresh();
  setInterval(refresh, 60000);
})();
