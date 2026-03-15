export const fromNodeHeaders = (
  headers: Record<string, string | string[] | undefined>,
): Headers => {
  const h = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (!value) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => h.append(key, v));
    } else {
      h.set(key, value);
    }
  }
  return h;
};
