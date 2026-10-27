/** Pure helpers for "ربط Tailscale" (no I/O). The app never talks to tailscaled and stores no Tailscale identity. */

/** The ONLY pages the app opens: the public Tailscale website, no query string, no identity. */
export const TAILSCALE_PAGES = {
  login: "https://login.tailscale.com/login",
  machines: "https://login.tailscale.com/admin/machines",
} as const;
export type TailscalePage = keyof typeof TAILSCALE_PAGES;
export const isPublicTailscaleUrl = (url: string) => (Object.values(TAILSCALE_PAGES) as string[]).includes(url);

/**
 * Browser launch for a PRIVATE window with a brand-new empty profile (--user-data-dir / -profile
 * pointing at a fresh temp dir) so no cookies, saved Google accounts or Windows SSO are reused.
 */
export function pickPrivateBrowser(env: Record<string, string | undefined>, exists: (path: string) => boolean, url: string, profileDir: string) {
  if (!isPublicTailscaleUrl(url)) return null;
  const roots = [env.ProgramFiles || "C:\\Program Files", env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", env.LOCALAPPDATA || ""].filter(Boolean);
  const fresh = ["--no-first-run", "--no-default-browser-check", `--user-data-dir=${profileDir}`];
  const options: [string, string, string[]][] = [
    ["edge", "Microsoft\\Edge\\Application\\msedge.exe", ["--inprivate", ...fresh, "--disable-features=msImplicitSignin,msEdgeAutoSignIn", "--new-window"]],
    ["chrome", "Google\\Chrome\\Application\\chrome.exe", ["--incognito", ...fresh, "--new-window"]],
    ["firefox", "Mozilla Firefox\\firefox.exe", ["-no-remote", "-profile", profileDir, "-private-window"]],
  ];
  for (const [name, rel, flags] of options)
    for (const root of roots) {
      const exe = `${root}\\${rel}`;
      if (exists(exe)) return { browser: name, exe, args: [...flags, url] };
    }
  return null;
}

/** IPv4 on a private LAN or Tailscale (100.64.0.0/10). Public internet addresses are refused. */
export function isDeviceAddress(host: string) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host || "");
  if (!m) return false;
  const o = m.slice(1).map(Number);
  if (o.some((n) => n > 255)) return false;
  const [a, b] = o;
  if (a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)) return true;
  return a === 100 && b >= 64 && b <= 127;
}

/** Branch device addresses typed by the user ("192.168.1.2" or "192.168.1.2:8000"). */
export function parseBranchTarget(text: string): { host: string; port: number } | null {
  const m = /^\s*(\d{1,3}(?:\.\d{1,3}){3})(?:\/32)?(?::(\d{1,5}))?\s*$/.exec(text || "");
  if (!m || !isDeviceAddress(m[1])) return null;
  const port = m[2] ? Number(m[2]) : 80;
  return port >= 1 && port <= 65535 ? { host: m[1], port } : null;
}
