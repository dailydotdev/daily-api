export const isAuthorMatchDomainIgnored = ({
  urls,
  ignoredDomains,
}: {
  urls: Array<string | null | undefined>;
  ignoredDomains?: string[];
}): boolean => {
  if (!ignoredDomains?.length) {
    return false;
  }

  const normalizedDomains = ignoredDomains
    .map((domain) => domain.trim().toLowerCase().replace(/\.+$/, ''))
    .filter(Boolean);

  return urls.some((url) => {
    if (!url) {
      return false;
    }

    try {
      const hostname = new URL(url).hostname.toLowerCase();

      return normalizedDomains.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      );
    } catch {
      return false;
    }
  });
};
