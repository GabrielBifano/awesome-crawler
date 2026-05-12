import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

const MAX_CHARS = 32_000;
const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

export function extractContent(html: string, url: string): string {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article?.content) {
    return truncate(turndown.turndown(html), MAX_CHARS);
  }

  const md = turndown.turndown(article.content);
  return truncate(md, MAX_CHARS);
}

export function extractStructure(html: string): string {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Remove noise elements
  for (const tag of ['script', 'style', 'svg', 'noscript', 'iframe', 'link', 'meta']) {
    for (const el of doc.querySelectorAll(tag)) {
      el.remove();
    }
  }

  // Remove comments
  const walker = doc.createTreeWalker(doc.body ?? doc.documentElement, 128);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  for (const c of comments) c.parentNode?.removeChild(c);

  // Strip unwanted attributes, keep useful ones
  const KEEP = new Set(['id', 'class', 'href', 'src', 'type', 'name', 'placeholder',
    'role', 'aria-label', 'aria-labelledby', 'aria-describedby', 'value',
    'action', 'method', 'for', 'data-testid', 'title', 'alt']);

  for (const el of doc.querySelectorAll('*')) {
    for (const attr of Array.from(el.attributes)) {
      if (!KEEP.has(attr.name)) {
        el.removeAttribute(attr.name);
      }
    }
    // Truncate long class strings
    const cls = el.getAttribute('class');
    if (cls && cls.length > 80) {
      el.setAttribute('class', cls.slice(0, 80));
    }
  }

  const body = doc.body?.innerHTML ?? doc.documentElement.innerHTML;
  const collapsed = body.replace(/\s{2,}/g, ' ').replace(/>\s+</g, '><').trim();
  return truncate(collapsed, MAX_CHARS);
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[truncated — content exceeded token budget]';
}
