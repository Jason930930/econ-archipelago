/** 拆除 Gmail 的 https://www.google.com/url?q=<target>&... 轉址包裝。 */
export function unwrapGoogleRedirect(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  const isGoogle = /(^|\.)google\.[a-z.]+$/.test(u.hostname);
  if (!isGoogle || u.pathname !== '/url') return url;
  const q = u.searchParams.get('q') ?? u.searchParams.get('url');
  return q ?? url;
}

export function isGoogleRedirect(url: string): boolean {
  return /google\.[a-z.]+\/url\?/.test(url);
}
