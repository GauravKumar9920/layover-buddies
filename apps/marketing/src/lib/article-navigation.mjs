import { parseFragment, serialize } from 'parse5';

const attribute = (node, name) => node.attrs?.find(item => item.name === name)?.value;
const text = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');
const escape = value => value.replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

// Render section links at build time so long articles remain navigable without JS.
export function addArticleNavigation(tree) {
  const ids = new Set();
  const articles = [];
  const visit = node => {
    const id = attribute(node, 'id');
    if (id) ids.add(id);
    if ((attribute(node, 'class') || '').split(/\s+/).includes('guide-body')) articles.push(node);
    for (const child of node.childNodes || []) visit(child);
  };
  visit(tree);
  for (const article of articles) {
    const headings = [];
    const collect = node => {
      if (node.tagName === 'h2') {
        const label = text(node).replace(/\s+/g, ' ').trim();
        if (!label) return;
        let id = attribute(node, 'id');
        if (!id) {
          const base = 'section-' + (label.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-') || 'guide');
          id = base;
          for (let count = 2; ids.has(id); count++) id = `${base}-${count}`;
          node.attrs ||= [];
          node.attrs.push({ name: 'id', value: id });
          ids.add(id);
        }
        headings.push({ id, label });
      }
      for (const child of node.childNodes || []) collect(child);
    };
    collect(article);
    if (headings.length < 2 || article.childNodes?.some(node => attribute(node, 'data-article-contents') !== undefined)) continue;
    const contents = parseFragment(`<details class="site-article-contents" data-article-contents><summary>On this page <span>${headings.length} sections</span></summary><ol>${headings.map(heading => `<li><a href="#${encodeURIComponent(heading.id)}">${escape(heading.label)}</a></li>`).join('')}</ol></details>`);
    for (const child of contents.childNodes) child.parentNode = article;
    article.childNodes.unshift(...contents.childNodes);
  }
  return tree;
}

export function articleHtmlWithNavigation(html) {
  const tree = parseFragment(`<article class="guide-body">${html}</article>`);
  addArticleNavigation(tree);
  return tree.childNodes[0].childNodes.map(node => serialize({ nodeName: '#document-fragment', childNodes: [node] })).join('');
}
