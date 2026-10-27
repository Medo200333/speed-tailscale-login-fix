/**
 * "ربط Tailscale": opens the PUBLIC Tailscale website in a private browser window with a fresh,
 * empty temporary profile. The app never runs tailscale.exe, never reads this PC's Tailscale
 * account, and stores no Tailscale email/account/tailnet. SPEED_TAILSCALE_DRYRUN=1 launches nothing.
 */
import { AccessError } from "./store.server";
import { TAILSCALE_PAGES, isDeviceAddress, isPublicTailscaleUrl, pickPrivateBrowser, type TailscalePage } from "./tailscale-core";
import { isapiFingerprint } from "./sadp.server";

const dry = () => process.env.SPEED_TAILSCALE_DRYRUN === "1";

/** Drop private-browser profiles left behind by earlier clicks. A dir still open by the browser is skipped. */
async function sweepOldProfiles(current: string) {
  const { readdirSync, rmSync, statSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const root = tmpdir();
  let names: string[] = [];
  try { names = readdirSync(root); } catch { return; }
  const cutoff = Date.now() - 2 * 60 * 1000;
  for (const name of names) {
    if (!name.startsWith("speed-tailscale-")) continue;
    const dir = join(root, name);
    if (dir === current) continue;
    try {
      if (statSync(dir).mtimeMs > cutoff) continue;
      rmSync(dir, { recursive: true, force: true });
    } catch { /* still in use */ }
  }
}

export async function openTailscaleSite(page: TailscalePage) {
  const url = TAILSCALE_PAGES[page] || TAILSCALE_PAGES.login;
  if (!isPublicTailscaleUrl(url)) throw new AccessError("TAILSCALE", "رابط غير صالح.");
  const { existsSync, mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const profileDir = mkdtempSync(join(tmpdir(), "speed-tailscale-"));
  await sweepOldProfiles(profileDir);
  const pick = pickPrivateBrowser(process.env, existsSync, url, profileDir);
  if (dry() || process.platform !== "win32")
    return { url, browser: pick?.browser || "none", private: Boolean(pick), freshProfile: Boolean(pick), args: pick?.args || [], dryRun: true };
  if (!pick) return { url, browser: "none", private: false, freshProfile: false, args: [], dryRun: false };
  const { spawn } = await import("node:child_process");
  spawn(pick.exe, pick.args, { windowsHide: false, detached: true, stdio: "ignore" }).unref();
  return { url, browser: pick.browser, private: true, freshProfile: true, args: [], dryRun: false };
}

/** Read-only reachability of one device address (unauthenticated GET deviceInfo; no passwords sent). */
export async function reachDevice(host: string, port: number) {
  if (!isDeviceAddress(host) || port < 1 || port > 65535) throw new AccessError("ENDPOINT", "العنوان لازم يكون IP خاص أو Tailscale، مش عنوان إنترنت عام.");
  const started = Date.now();
  try {
    const res = await fetch(`http://${host}:${port}/ISAPI/System/deviceInfo`, { redirect: "manual", signal: AbortSignal.timeout(4000) });
    const print = isapiFingerprint(res.status, res.headers.get("www-authenticate") || "", res.status === 200 ? (await res.text()).slice(0, 8000) : "");
    return { reachable: true, hikvision: Boolean(print), model: print?.model || "", ms: Date.now() - started };
  } catch {
    return { reachable: false, hikvision: false, model: "", ms: Date.now() - started };
  }
}
