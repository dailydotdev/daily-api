// Mock for isomorphic-dompurify to avoid ESM compatibility issues in Jest
// When using dynamic import(), the module is accessed directly (not via .default)
// because Jest's moduleNameMapper resolves to this file which exports these functions directly

export const sanitize = (html: string): string => {
  // Simple mock that returns the input - actual sanitization not needed in tests
  return html;
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
