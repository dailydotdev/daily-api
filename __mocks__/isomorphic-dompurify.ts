// Mock for isomorphic-dompurify to avoid ESM compatibility issues in Jest
const DOMPurify = {
  sanitize: (html: string): string => {
    // Simple mock that returns the input - actual sanitization not needed in tests
    return html;
  },
};

export default DOMPurify;
