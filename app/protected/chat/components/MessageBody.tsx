import React, { useEffect, useRef } from 'react';
import katex from 'katex';

export function MessageBody({ html }: { html?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const root = ref.current;
    const inlineEls = root.querySelectorAll('span[data-type="inline-math"]');
    inlineEls.forEach((el) => {
      const latex = (el as HTMLElement).getAttribute('data-latex') || '';
      try { katex.render(latex, el as HTMLElement, { throwOnError: false, displayMode: false }); } catch {}
    });
    const blockEls = root.querySelectorAll('div[data-type="block-math"]');
    blockEls.forEach((el) => {
      const latex = (el as HTMLElement).getAttribute('data-latex') || '';
      try { katex.render(latex, el as HTMLElement, { throwOnError: false, displayMode: true }); } catch {}
    });
  });
  if (!html) return null;
  return <div ref={ref} className="prose prose-invert max-w-none text-sm break-words" dangerouslySetInnerHTML={{ __html: html }} />;
}

