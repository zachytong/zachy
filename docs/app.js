(async () => {
  const { esc, icon, icons, markdown, read, write } = Blog;
  const flow = document.getElementById('book-flow');
  const viewport = document.getElementById('page-window');
  const reader = document.querySelector('.reader');
  const position = document.getElementById('page-position');
  const previous = document.getElementById('previous-page');
  const next = document.getElementById('next-page');
  const readerFooter = document.querySelector('.reader-footer');
  const backgroundReturn = document.getElementById('background-return');
  const contents = document.getElementById('contents-dialog');
  const search = document.getElementById('search-dialog');
  const mobile = matchMedia('(max-width: 820px)');
  let desktopMode = read('blog-reader-mode', 'pages');
  let posts = [], current = null, page = 0, pageCount = 1, mode = mobile.matches ? 'scroll' : desktopMode, fontSize = Number(read('blog-font-size', '16'));
  let toastTimer, measuring = false, backgroundView = false, savedBackgroundProgress = 0, savedBackgroundScroll = 0;
  const t = (zh, en) => Blog.lang === 'zh' ? zh : en;
  const route = () => new URL(location.href);
  const isHome = () => document.body.dataset.page === 'home';
  const hasBackgrounds = () => document.body.dataset.backgroundAvailable === 'true';
  const nativeMacHistory = /mac/i.test(navigator.userAgentData?.platform || navigator.platform);
  const wantsBackground = () => isHome() && route().searchParams.get('screen') === 'background';
  function ensureHomeHistory() {
    if (!isHome() || !hasBackgrounds() || wantsBackground() || (history.state?.blogScreen === 'notes' && history.state?.blogPair)) return;
    const notesURL = route(), backgroundURL = route();
    backgroundURL.searchParams.set('screen', 'background');
    const pair = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // Native browser Back reveals 00; another Back can still leave the site.
    history.replaceState({ ...history.state, blogScreen: 'background', blogPair: pair }, '', backgroundURL);
    history.pushState({ blogScreen: 'notes', blogPair: pair }, '', notesURL);
  }
  const date = value => new Date(value).toLocaleDateString(Blog.lang === 'zh' ? 'zh-CN' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  const href = id => `?post=${encodeURIComponent(id)}&lang=${Blog.lang}`;
  const bookmarks = () => { try { return JSON.parse(read('blog-bookmarks', '[]')); } catch { return []; } };
  function toast(text) { const el = document.getElementById('toast'); el.textContent = text; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2300); }
  function progress() {
    if (mobile.matches) {
      const top = viewport.getBoundingClientRect().top + window.scrollY;
      return Math.max(0, Math.min(1, (window.scrollY - top) / Math.max(1, viewport.scrollHeight - window.innerHeight)));
    }
    return mode === 'scroll' ? viewport.scrollTop / Math.max(1, viewport.scrollHeight - viewport.clientHeight) : page / Math.max(1, pageCount - 1);
  }
  function remember() { if (current && !measuring && !backgroundView) write(`blog-progress-${current.id}-${Blog.lang}`, String(progress())); }
  function updatePosition(saveProgress = true) {
    if (backgroundView) {
      position.textContent = '00';
      previous.disabled = true;
      next.disabled = false;
      next.querySelector('span').textContent = t('返回博客', 'Back to notes');
      next.setAttribute('aria-label', t('返回博客', 'Back to notes'));
      next.title = t('返回博客', 'Back to notes');
      return;
    }
    reader.style.setProperty('--page', page);
    position.textContent = `${String(page + 1).padStart(2, '0')} / ${String(pageCount).padStart(2, '0')}`;
    previous.disabled = page === 0 && !(isHome() && hasBackgrounds());
    next.disabled = page >= pageCount - 1;
    previous.querySelector('span').textContent = page === 0 && isHome() && hasBackgrounds() ? t('什么都不想也没关系', 'It’s okay to switch off') : t('上一页', 'Previous');
    previous.setAttribute('aria-label', page === 0 && isHome() && hasBackgrounds() ? t('欣赏背景', 'View background') : t('上一页', 'Previous page'));
    next.querySelector('span').textContent = t('下一页', 'Next');
    next.setAttribute('aria-label', t('下一页', 'Next page'));
    next.title = t('下一页', 'Next page');
    document.getElementById('reading-progress').style.width = `${mode === 'scroll' ? progress() * 100 : (page + 1) / pageCount * 100}%`;
    if (saveProgress) remember();
  }
  function measure(ratio = 0) {
    if (backgroundView) return updatePosition();
    measuring = true;
    if (mode === 'scroll') {
      if (mobile.matches) {
        const top = viewport.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, ratio > 0 ? top + ratio * Math.max(0, viewport.scrollHeight - window.innerHeight) : 0);
      } else viewport.scrollTop = ratio * Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      pageCount = 1; page = 0;
    } else {
      const gap = parseFloat(getComputedStyle(flow).columnGap) || 0;
      pageCount = Math.max(1, Math.ceil((flow.scrollWidth + gap - 2) / (viewport.clientWidth + gap)));
      page = Math.max(0, Math.min(pageCount - 1, Math.round(ratio * (pageCount - 1))));
    }
    measuring = false;
    updatePosition();
  }
  function applyBackgroundView(visible, capture = true) {
    if (visible === backgroundView || (visible && (!isHome() || !hasBackgrounds()))) return;
    const keyboardFocus = document.activeElement !== document.body && document.activeElement?.matches(':focus-visible');
    if (visible && capture) { savedBackgroundProgress = progress(); savedBackgroundScroll = window.scrollY; }
    backgroundView = visible;
    document.title = visible ? `${t('背景', 'Background')} · Zachy Notes` : 'Zachy Notes · flow with it.';
    reader.setAttribute('aria-label', visible ? t('背景欣赏', 'Background viewer') : t('博客阅读器', 'Blog reader'));
    document.body.classList.toggle('background-view', visible);
    if (visible) {
      backgroundReturn.append(position, next);
      backgroundReturn.hidden = false;
    } else {
      readerFooter.append(position, next);
      backgroundReturn.hidden = true;
    }
    contents.close(); search.close();
    document.dispatchEvent(new CustomEvent('blog:background-view', { detail: { active: visible } }));
    updatePosition();
    if (visible) { window.scrollTo(0, 0); if (keyboardFocus) next.focus({ preventScroll: true }); }
    else requestAnimationFrame(() => { measure(savedBackgroundProgress); if (mobile.matches) window.scrollTo(0, savedBackgroundScroll); });
  }
  function setBackgroundView(visible) {
    if (visible === backgroundView || !isHome()) return;
    if (visible) {
      if (!hasBackgrounds()) return;
      ensureHomeHistory();
      history.back();
    } else {
      const url = route(); url.searchParams.delete('screen');
      history.pushState({ blogScreen: 'notes', blogPair: history.state?.blogPair || `background-${Date.now()}` }, '', url);
      render(savedBackgroundProgress);
    }
  }
  function goPage(value) {
    if (backgroundView) return setBackgroundView(false);
    if (value < 0 && isHome() && hasBackgrounds()) return setBackgroundView(true);
    page = Math.max(0, Math.min(pageCount - 1, value)); updatePosition();
  }
  function jump(el) {
    if (mode === 'scroll') el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    else { const gap = parseFloat(getComputedStyle(flow).columnGap) || 0; const offset = el.getBoundingClientRect().left - flow.getBoundingClientRect().left; goPage(Math.floor((offset + 2) / (viewport.clientWidth + gap))); }
    contents.close();
  }
  function metadata(post) { return `<div class="post-meta"><time datetime="${esc(post.createdAt)}">${esc(date(post.createdAt))}</time><span class="meta-dot"></span><span>${esc(post.tags.split(',')[0])}</span><span class="meta-dot"></span><span>${t('中 / EN', 'ZH / EN')}</span></div>`; }
  function drawContents(savedOnly = false) {
    document.getElementById('drawer-title').textContent = savedOnly ? t('我的收藏', 'Bookmarks') : t('目录', 'Contents');
    const container = document.getElementById('contents-list');
    if (current && !savedOnly) {
      const headings = [...flow.querySelectorAll('h1, h2, h3')];
      container.innerHTML = headings.map((h, i) => `<button class="contents-item" data-heading="${i}" style="padding-left:${h.tagName === 'H3' ? 18 : 5}px">${esc(h.textContent)}</button>`).join('');
      container.querySelectorAll('[data-heading]').forEach(button => button.onclick = () => jump(headings[Number(button.dataset.heading)]));
    } else {
      const list = savedOnly ? posts.filter(p => bookmarks().includes(p.id)) : posts;
      container.innerHTML = list.length ? list.map(p => `<a class="contents-item" href="${href(p.id)}"><small>${esc(date(p.createdAt))}</small>${esc(p[Blog.lang].title)}</a>`).join('') : `<p class="empty-state">${t('还没有收藏文章', 'No bookmarks yet')}</p>`;
    }
  }
  function render(ratio) {
    const url = route();
    const requestedLanguage = url.searchParams.get('lang');
    if (['zh', 'en'].includes(requestedLanguage)) Blog.setLang(requestedLanguage);
    current = posts.find(p => p.id === url.searchParams.get('post')) || null;
    const view = url.searchParams.get('view') || 'blog';
    document.body.dataset.page = url.searchParams.has('post') ? 'article' : view === 'blog' ? 'home' : view;
    const showBackground = wantsBackground();
    const returnScroll = backgroundView && !showBackground && isHome() ? savedBackgroundScroll : null;
    if (showBackground && !backgroundView) { savedBackgroundProgress = progress(); savedBackgroundScroll = window.scrollY; }
    if (backgroundView && !showBackground) { ratio ??= isHome() ? savedBackgroundProgress : 0; applyBackgroundView(false); }
    document.querySelectorAll('[data-nav]').forEach(a => { a.textContent = { blog: t('博客', 'Blog'), archive: t('归档', 'Archive'), about: t('关于', 'About') }[a.dataset.nav]; a.href = a.dataset.nav === 'blog' ? `?lang=${Blog.lang}` : `?view=${a.dataset.nav}&lang=${Blog.lang}`; a.toggleAttribute('aria-current', a.dataset.nav === view); });
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === Blog.lang)));
    document.getElementById('search-input').placeholder = t('搜索文章、主题或关键词…', 'Search notes, topics, or keywords…');
    document.getElementById('print-button').hidden = !current;
    const labels = { 'contents-button': t('目录', 'Contents'), 'font-button': t('字号', 'Font size'), 'bookmark-button': t('收藏', 'Bookmarks'), 'search-button': t('搜索', 'Search'), 'print-button': t('打印 / PDF', 'Print / PDF') };
    for (const [id, label] of Object.entries(labels)) { const b = document.getElementById(id); b.title = label; b.setAttribute('aria-label', label); }
    document.getElementById('running-title').textContent = 'Random Thoughts';
    if (current) {
      const content = current[Blog.lang];
      document.title = `${content.title} · Zachy Notes`;
      flow.innerHTML = `<article><header class="article-header">${metadata(current)}<h1>${esc(content.title)}</h1><p class="article-description">${esc(content.excerpt)}</p><div class="article-actions"><a href="?lang=${Blog.lang}">${t('← 所有文章', '← All notes')}</a>${current.source ? `<a href="legacy/${encodeURIComponent(current.source)}" target="_blank" rel="noopener">${t('原始图文与导出', 'Original diagrams & exports')} ↗</a>` : ''}</div>${Blog.lang === 'en' && current.englishEdition === 'condensed' ? '<p class="translation-note">English reading edition, condensed from the complete Chinese notes.</p>' : ''}</header><div class="article-content">${markdown(content.markdown)}</div><p class="end-mark">${t('读到这里，留下自己的理解。', 'A little more understood.')}<br>· · ·</p></article>`;
    } else if (url.searchParams.has('post')) {
      flow.innerHTML = `<h1>${t('没有找到这篇文章', 'Note not found')}</h1><p><a href="./">${t('返回博客', 'Back to the blog')}</a></p>`;
    } else if (view === 'archive') {
      document.title = `${t('归档', 'Archive')} · Zachy Notes`;
      flow.innerHTML = `<h1>${t('写下来的，都在这里。', 'Everything, in one place.')}</h1><p class="post-meta">${posts.length} ${t('篇笔记', 'notes')} · 中文 / English</p><h2 class="archive-year">2026</h2>${posts.map(p => `<div class="archive-item"><time>${new Date(p.createdAt).toLocaleDateString('en-GB', { month: '2-digit', day: '2-digit' })}</time><a href="${href(p.id)}">${esc(p[Blog.lang].title)}</a></div>`).join('')}`;
    } else if (view === 'about') {
      document.title = `${t('关于', 'About')} · Zachy Notes`;
      flow.innerHTML = `<article class="about-copy"><img class="about-image" src="avatar.png" alt="Zachy"><p class="post-meta">ZACHY NOTES</p><h1>${t('你好，我是 Zachy。', 'Hello, I’m Zachy.')}</h1><p>flow with it.</p><p><a href="https://github.com/zachytong" target="_blank" rel="noopener">GitHub ↗</a></p></article>`;
    } else {
      document.title = 'Zachy Notes · flow with it.';
      flow.innerHTML = posts.length ? posts.map(p => {
        const content = p[Blog.lang];
        const intro = content.excerpt || content.markdown.replace(/[#*`>]/g, '').slice(0, 300);
        const paragraphs = intro.split(/\n\n+/).filter(Boolean);
        return `<article class="post-entry" id="entry-${esc(p.id)}">${metadata(p)}<h2><a href="${href(p.id)}">${esc(content.title)}</a></h2>${paragraphs.map(s => `<p>${esc(s)}</p>`).join('')}<a class="continue-link" href="${href(p.id)}">${t('继续阅读', 'Continue reading')} ${icon('arrow-up-right')}</a><div class="post-separator"></div></article>`;
      }).join('') + `<p class="end-mark">${t('未完，待续。', 'More notes to come.')} · · ·</p>` : `<h1>${t('书页正等待第一篇笔记。', 'The first page is waiting.')}</h1>`;
    }
    reader.dataset.mode = mode;
    reader.style.setProperty('--reader-size', `${fontSize}px`);
    const modeButton = document.getElementById('mode-button');
    modeButton.hidden = mobile.matches;
    modeButton.innerHTML = icon(mode === 'pages' ? 'arrow-down-up' : 'book-open');
    modeButton.title = mode === 'pages' ? t('滚动阅读', 'Scroll mode') : t('翻页阅读', 'Page mode'); modeButton.setAttribute('aria-label', modeButton.title);
    document.getElementById('bookmark-button').setAttribute('aria-pressed', String(Boolean(current && bookmarks().includes(current.id))));
    Blog.typeset(flow); drawContents(); Blog.applyTheme(); icons();
    document.dispatchEvent(new Event('blog:render'));
    ensureHomeHistory();
    if (showBackground) { applyBackgroundView(true, false); document.title = `${t('背景', 'Background')} · Zachy Notes`; }
    const restore = ratio ?? (current ? Number(read(`blog-progress-${current.id}-${Blog.lang}`, '0')) : 0);
    requestAnimationFrame(() => { measure(restore); if (returnScroll !== null && mobile.matches) window.scrollTo(0, returnScroll); });
    flow.querySelectorAll('img').forEach(img => img.addEventListener('load', () => measure(progress()), { once: true }));
  }
  function navigate(url) { remember(); history.pushState({}, '', url); contents.close(); render(0); }
  document.addEventListener('click', e => {
    const a = e.target.closest('a');
    if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const url = new URL(a.href, location.href);
    if (url.origin === location.origin && url.pathname === location.pathname && !url.hash) { e.preventDefault(); navigate(url); }
    else if (a.getAttribute('href')?.startsWith('#')) {
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (target && flow.contains(target)) { e.preventDefault(); jump(target); }
    }
  });
  document.querySelector('[data-theme-button]').onclick = Blog.setTheme;
  document.querySelectorAll('[data-lang]').forEach(button => button.onclick = () => {
    const ratio = progress(); remember(); Blog.setLang(button.dataset.lang);
    const url = route(); url.searchParams.set('lang', Blog.lang); history.replaceState(history.state, '', url); render(ratio);
  });
  previous.onclick = () => goPage(page - 1); next.onclick = () => goPage(page + 1);
  document.getElementById('contents-button').onclick = () => { drawContents(); contents.showModal(); };
  document.getElementById('mode-button').onclick = () => { if (mobile.matches) return; const ratio = progress(); desktopMode = mode === 'pages' ? 'scroll' : 'pages'; mode = desktopMode; write('blog-reader-mode', mode); render(ratio); };
  document.getElementById('font-button').onclick = () => { const ratio = progress(); fontSize = fontSize >= 20 ? 16 : fontSize + 2; write('blog-font-size', String(fontSize)); render(ratio); toast(`${t('字号', 'Font size')} ${fontSize}`); };
  document.getElementById('bookmark-button').onclick = () => {
    if (!current) { drawContents(true); return contents.showModal(); }
    const saved = bookmarks(); const exists = saved.includes(current.id);
    write('blog-bookmarks', JSON.stringify(exists ? saved.filter(id => id !== current.id) : [...saved, current.id]));
    document.getElementById('bookmark-button').setAttribute('aria-pressed', String(!exists));
    toast(exists ? t('已取消收藏', 'Bookmark removed') : t('已收藏文章', 'Note bookmarked'));
  };
  document.getElementById('print-button').onclick = () => window.print();
  function searchPosts() {
    const query = document.getElementById('search-input').value.trim().toLowerCase();
    const result = posts.filter(p => `${p.zh.title} ${p.en.title} ${p.tags} ${p.zh.excerpt} ${p.en.excerpt}`.toLowerCase().includes(query));
    document.getElementById('search-results').innerHTML = result.length ? result.map(p => `<a class="search-result" href="${href(p.id)}"><strong>${esc(p[Blog.lang].title)}</strong><small>${esc(p.tags)} · ${esc(date(p.createdAt))}</small></a>`).join('') : `<p class="empty-state">${t('没有找到相关笔记', 'No matching notes')}</p>`;
  }
  document.getElementById('search-button').onclick = () => { searchPosts(); search.showModal(); document.getElementById('search-input').focus(); };
  document.getElementById('search-input').oninput = searchPosts;
  document.querySelectorAll('.close-dialog').forEach(button => button.onclick = () => button.closest('dialog').close());
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } }));
  document.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.matches('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
    if (backgroundView && ['ArrowRight', 'Escape'].includes(event.key)) { event.preventDefault(); setBackgroundView(false); return; }
    if (!backgroundView && event.key === 'ArrowLeft' && isHome() && page === 0 && hasBackgrounds()) { event.preventDefault(); setBackgroundView(true); return; }
    if (backgroundView) return;
    if (event.key === 'ArrowRight' && mode === 'pages') { event.preventDefault(); goPage(page + 1); }
    if (event.key === 'ArrowLeft' && mode === 'pages') { event.preventDefault(); goPage(page - 1); }
    if (event.key.toLowerCase() === 't') Blog.setTheme();
  });
  let wheelDistance = 0, wheelTime = 0, gestureLock = 0;
  function backgroundGesture(direction) {
    if (performance.now() < gestureLock) return;
    if (direction < 0 && !backgroundView && isHome() && page === 0 && hasBackgrounds()) {
      gestureLock = performance.now() + 750; setBackgroundView(true);
    } else if (direction > 0 && backgroundView) {
      gestureLock = performance.now() + 750; setBackgroundView(false);
    }
  }
  document.addEventListener('wheel', event => {
    if (nativeMacHistory) return;
    if ((!backgroundView && (!isHome() || page !== 0 || !hasBackgrounds())) || document.querySelector('dialog[open]') || event.ctrlKey) return;
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.25) return;
    if (event.cancelable) event.preventDefault();
    const now = performance.now();
    if (now - wheelTime > 160 || Math.sign(wheelDistance) !== Math.sign(event.deltaX)) wheelDistance = 0;
    wheelTime = now;
    wheelDistance += event.deltaX * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerWidth : 1);
    if (Math.abs(wheelDistance) >= 65) { backgroundGesture(Math.sign(wheelDistance)); wheelDistance = 0; }
  }, { passive: nativeMacHistory });
  let touchStart = null;
  document.addEventListener('touchstart', event => {
    if (event.touches.length === 1 && (backgroundView || (isHome() && page === 0 && hasBackgrounds())) && !document.querySelector('dialog[open]')) touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    else touchStart = null;
  }, { passive: true });
  document.addEventListener('touchmove', event => {
    if (!touchStart || event.touches.length !== 1) return;
    const dx = event.touches[0].clientX - touchStart.x, dy = event.touches[0].clientY - touchStart.y;
    if (Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy) * 1.5 && event.cancelable) event.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', event => {
    if (!touchStart || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - touchStart.x, dy = event.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) >= 65 && Math.abs(dx) > Math.abs(dy) * 1.5) backgroundGesture(Math.sign(dx));
  }, { passive: true });
  document.addEventListener('touchcancel', () => { touchStart = null; });
  document.addEventListener('blog:backgrounds-change', () => {
    if (backgroundView && !hasBackgrounds()) applyBackgroundView(false);
    ensureHomeHistory();
    if (wantsBackground() && !backgroundView && hasBackgrounds()) applyBackgroundView(true);
    updatePosition(false);
  });
  viewport.addEventListener('scroll', () => { if (mode === 'scroll') updatePosition(); });
  window.addEventListener('scroll', () => { if (mobile.matches) updatePosition(); }, { passive: true });
  mobile.addEventListener('change', () => { mode = mobile.matches ? 'scroll' : desktopMode; render(0); });
  let resizeTimer;
  new ResizeObserver(() => { if (backgroundView) return; const ratio = progress(); clearTimeout(resizeTimer); resizeTimer = setTimeout(() => measure(ratio), 80); }).observe(viewport);
  window.addEventListener('popstate', () => render());
  try {
    const response = await fetch('posts.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load posts');
    posts = await response.json(); render();
  } catch (error) { flow.innerHTML = `<h1>${t('暂时无法打开书页', 'Unable to load notes')}</h1><p>${esc(error.message)}</p><a href="./">${t('重新载入', 'Reload')}</a>`; }
})();
