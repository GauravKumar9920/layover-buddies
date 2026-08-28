import type { PortableTextBlock, PortableTextSpan } from './site-pages';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

function safeHref(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^(?:\/\/|\\)/.test(value)) return undefined;
  if (/^(?:https?:|mailto:|tel:|\/|#)/i.test(value)) return escapeHtml(value);
  return undefined;
}

function renderSpan(span: PortableTextSpan, block: PortableTextBlock): string {
  let output = escapeHtml(span.text || '').replace(/\n/g, '<br>');
  for (const mark of span.marks || []) {
    if (mark === 'strong') output = `<strong>${output}</strong>`;
    else if (mark === 'em') output = `<em>${output}</em>`;
    else if (mark === 'code') output = `<code>${output}</code>`;
    else if (mark === 'underline') output = `<u>${output}</u>`;
    else {
      const definition = block.markDefs?.find((item) => item._key === mark);
      const href = definition?._type === 'link' ? safeHref(definition.href) : undefined;
      if (href) {
        const external = /^https?:/i.test(href);
        output = `<a href="${href}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${output}</a>`;
      }
    }
  }
  return output;
}

function renderBlock(block: PortableTextBlock, headingId?: string): string {
  if (block._type === 'image' && block.asset?.url) {
    const url = safeHref(block.asset.url);
    if (!url) return '';
    return `<figure><img src="${url}" alt="${escapeHtml(block.asset.alt || '')}" loading="lazy" decoding="async"></figure>`;
  }
  if (block._type !== 'block') return '';

  const contents = (block.children || []).map((span) => renderSpan(span, block)).join('');
  const allowedStyles: Record<string, string> = {
    normal: 'p',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    blockquote: 'blockquote',
  };
  const tag = allowedStyles[block.style || 'normal'] || 'p';
  return `<${tag}${headingId ? ` id="${headingId}"` : ''}>${contents}</${tag}>`;
}

export function portableTextToHtml(blocks: PortableTextBlock[] = []): string {
  let output = '';
  let openList: 'bullet' | 'number' | undefined;
  const headingIds = new Map<string, number>();

  for (const block of blocks) {
    if (block.listItem) {
      if (openList !== block.listItem) {
        if (openList) output += openList === 'number' ? '</ol>' : '</ul>';
        output += block.listItem === 'number' ? '<ol>' : '<ul>';
        openList = block.listItem;
      }
      const contents = (block.children || []).map((span) => renderSpan(span, block)).join('');
      output += `<li>${contents}</li>`;
      continue;
    }
    if (openList) {
      output += openList === 'number' ? '</ol>' : '</ul>';
      openList = undefined;
    }
    let headingId: string | undefined;
    if (/^h[2-4]$/.test(block.style || '')) {
      const text = (block.children || []).map((span) => span.text || '').join(' ');
      const base = text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-') || 'section';
      const count = headingIds.get(base) || 0;
      headingIds.set(base, count + 1);
      headingId = count ? `${base}-${count + 1}` : base;
    }
    output += renderBlock(block, headingId);
  }
  if (openList) output += openList === 'number' ? '</ol>' : '</ul>';
  return output;
}
