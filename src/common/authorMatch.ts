const normalizeHostname = (value: string): string =>
  value.trim().toLowerCase().replace(/\.+$/, '');

const isDomainMatch = ({
  hostname,
  domain,
}: {
  hostname: string;
  domain: string;
}): boolean => {
  const normalizedHostname = normalizeHostname(hostname);
  const normalizedDomain = normalizeHostname(domain);

  if (!normalizedHostname || !normalizedDomain) {
    return false;
  }

  return (
    normalizedHostname === normalizedDomain ||
    normalizedHostname.endsWith(`.${normalizedDomain}`)
  );
};

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

  return urls.some((url) => {
    if (!url) {
      return false;
    }

    try {
      const { hostname } = new URL(url);

      return ignoredDomains.some((domain) =>
        isDomainMatch({ hostname, domain }),
      );
    } catch {
      return false;
    }
  });
};
