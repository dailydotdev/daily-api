import { parse } from 'node-html-parser';

type SanitizeConfig = {
  ALLOWED_TAGS?: string[];
};

export const sanitize = (html: string, config?: SanitizeConfig): string => {
  if (config?.ALLOWED_TAGS?.length !== 0) {
    return html;
  }

  const root = parse(html);
  root.querySelectorAll('script,style').forEach((node) => node.remove());
  return root.textContent
    .split('<script')
    .join('')
    .split('<style')
    .join('')
    .split('<')
    .join('')
    .split('>')
    .join('');
};

export const addHook = (): void => {
  // No-op in tests
};

export const removeHook = (): void => {
  // No-op in tests
};

// Also export as default for compatibility with different import styles
const DOMPurify = {
  sanitize,
  addHook,
  removeHook,
};

export default DOMPurify;
