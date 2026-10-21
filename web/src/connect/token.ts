// The connect token arrives in the URL (?t=...). It is single use and short lived, but it should not sit in the
// address bar or browser history, so it is moved to sessionStorage (this tab only) and the URL is cleaned.
const KEY = "tail.connect.token";
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export function takeToken(
  loc: { search: string; pathname: string },
  hist: { replaceState: (state: unknown, title: string, url: string) => void },
  storage: Store | undefined,
): string | undefined {
  const fromUrl = new URLSearchParams(loc.search).get("t");
  if (fromUrl !== null) hist.replaceState(null, "", loc.pathname);
  if (fromUrl !== null && TOKEN_RE.test(fromUrl)) {
    try {
      storage?.setItem(KEY, fromUrl);
    } catch {
      /* blocked storage: the token still works for this page load */
    }
    return fromUrl;
  }
  try {
    const saved = storage?.getItem(KEY);
    return saved && TOKEN_RE.test(saved) ? saved : undefined;
  } catch {
    return undefined;
  }
}
