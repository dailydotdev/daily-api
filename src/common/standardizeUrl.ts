const excludeFromStandardization = ['youtube.com'];

const isExcluded = (url: string) =>
  excludeFromStandardization.some((e) => url.includes(e));

const subtractDomain = (url: string): string => {
  const matches = url.match(
    /^(?:https?:\/\/)?(?:[^@/\n]+@)?(?:www\.)?([^:/?\n]+)/i,
  );
  return matches && matches[1];
};

export const standardizeURL = (url: string): string => {
  const domain = subtractDomain(url);
  if (!isExcluded(domain)) {
    return url.split('?')[0];
  }

  return url;
};
