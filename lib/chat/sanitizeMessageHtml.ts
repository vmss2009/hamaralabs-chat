import DOMPurify from 'dompurify';

// Message HTML comes from other users and is stored as-is by the API, so it is
// untrusted: it must go through this before it touches the DOM.
const PURIFY_CONFIG = {
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'option', 'img', 'picture', 'video', 'audio', 'source', 'svg', 'math'],
  // No class/id: app CSS (e.g. Tailwind "fixed inset-0") could otherwise be used to overlay the UI.
  FORBID_ATTR: ['class', 'id', 'name'],
  // TipTap's table column width attribute (inert in browsers).
  ADD_ATTR: ['colwidth'],
};

// Inline styles the editor actually produces (text colour, highlight, alignment, table column widths).
const ALLOWED_STYLE_PROPS = ['color', 'background-color', 'text-align', 'width', 'min-width'];

if (DOMPurify.isSupported) {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    const el = node as HTMLElement;
    if (el.style && el.hasAttribute('style')) {
      const kept = ALLOWED_STYLE_PROPS
        .map((prop) => [prop, el.style.getPropertyValue(prop)] as const)
        .filter(([, value]) => value && !/url\s*\(|expression\s*\(/i.test(value))
        .map(([prop, value]) => `${prop}: ${value}`);
      if (kept.length) el.setAttribute('style', kept.join('; '));
      else el.removeAttribute('style');
    }
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  });
}

export function sanitizeMessageHtml(html: string): string {
  // DOMPurify needs a DOM; without one (SSR) return nothing rather than raw HTML.
  if (!DOMPurify.isSupported) return '';
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}
