window.Blog = (() => {
  const read = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
  const icons = () => window.lucide?.createIcons({ attrs: { 'stroke-width': 1.5 } });
  const markdown = text => DOMPurify.sanitize(marked.parse(text || ''), { FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'button'], FORBID_ATTR: ['style'] });
  const url = new URL(location.href);
  let lang = ['zh', 'en'].includes(url.searchParams.get('lang')) ? url.searchParams.get('lang') : read('blog-lang', 'zh');
  if (!['zh', 'en'].includes(lang)) lang = 'zh';
  let theme = read('blog-theme', 'light');
  document.documentElement.dataset.theme = theme;
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  const applyTheme = () => {
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll('[data-theme-button]').forEach(button => { button.innerHTML = icon(theme === 'dark' ? 'sun' : 'moon'); button.title = lang === 'zh' ? '切换日夜模式' : 'Toggle light / dark'; button.setAttribute('aria-label', button.title); button.setAttribute('aria-pressed', String(theme === 'dark')); });
    icons();
  };
  const setTheme = () => { theme = theme === 'dark' ? 'light' : 'dark'; write('blog-theme', theme); applyTheme(); };
  const setLang = value => { lang = value; write('blog-lang', value); document.documentElement.lang = value === 'zh' ? 'zh-CN' : 'en'; };
  async function api(path, data, method = 'POST') {
    const response = await fetch(path, data === undefined ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || 'Request failed');
    return value;
  }
  const typeset = element => {
    const seen = new Set();
    element.querySelectorAll('h1, h2, h3, h4').forEach(heading => {
      const base = heading.id || heading.textContent.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-');
      let id = base || 'section', count = 1;
      while (seen.has(id)) id = `${base}-${++count}`;
      heading.id = id; seen.add(id);
    });
    window.renderMathInElement?.(element, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }, { left: '\\(', right: '\\)', display: false }, { left: '\\[', right: '\\]', display: true }], throwOnError: false, trust: false });
  };
  return { read, write, esc, icon, icons, markdown, typeset, applyTheme, setTheme, setLang, api, get lang() { return lang; }, get theme() { return theme; } };
})();
