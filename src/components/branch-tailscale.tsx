import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { tsOpenSiteFn, reachDeviceFn } from "@/lib/tailscale.functions";
import { TAILSCALE_PAGES, parseBranchTarget } from "@/lib/access/tailscale-core";
import { Button } from "./access-ui";

type Found = { ip: string; httpPort: number; model: string; peer: string };
type Row = { name: string; host: string; port: number; result?: string; model?: string; ok?: boolean };
const KEY = "speed-branch-targets";
const load = (): Row[] => { try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v.filter((r) => r && parseBranchTarget(`${r.host}:${r.port}`)).map((r) => ({ name: String(r.name || "").slice(0, 60), host: r.host, port: r.port })) : []; } catch { return []; } };

/**
 * "ربط Tailscale": opens the public Tailscale website (no email, no saved account) in a private
 * window with a fresh empty profile. The client signs in with THEIR OWN account there, approves
 * the branch subnet routes, then types each branch device IP here and tests it.
 */
export function TailscaleLink({ onPick }: { onPick: (row: Found) => void }) {
  const openSite = useServerFn(tsOpenSiteFn), reach = useServerFn(reachDeviceFn);
  const [open, setOpen] = useState(false), [note, setNote] = useState(""), [warn, setWarn] = useState("");
  const [rows, setRows] = useState<Row[]>([]), [ip, setIp] = useState(""), [label, setLabel] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { setRows(load()); }, []);
  const save = (next: Row[]) => { setRows(next); try { localStorage.setItem(KEY, JSON.stringify(next.map(({ name, host, port }) => ({ name, host, port })))); } catch { /* private mode */ } };
  const go = async (page: "login" | "machines") => {
    setOpen(true); setWarn(""); setNote("جارٍ فتح موقع Tailscale في نافذة خاصة…");
    try {
      const r = await openSite({ data: { page } });
      if (!r.ok) return setNote(r.error);
      setNote(r.data.dryRun ? "وضع تجريبي: لم يُفتح متصفح." : "اتفتح موقع Tailscale في نافذة خاصة جديدة بدون أي حساب محفوظ. سجّل الدخول بحساب Tailscale بتاعك (اللي عليه كمبيوترات الفروع).");
      if (!r.data.private && !r.data.dryRun) setWarn("لم يُعثر على Edge أو Chrome أو Firefox. اضغط «نسخ الرابط» وافتحه في نافذة خاصة (Ctrl+Shift+N).");
    } catch { setNote("انقطع الاتصال بالبرنامج. أعد المحاولة."); }
  };
  const copy = (url: string) => void navigator.clipboard?.writeText(url).then(() => setNote("تم نسخ الرابط."), () => setNote("انسخ الرابط يدوياً: " + url));
  const add = () => {
    const t = parseBranchTarget(ip);
    if (!t) return setWarn("اكتب عنوان IP خاص للبصمة، مثل 192.168.1.2 أو 100.64.0.2:8000. عنوان الإنترنت العام مرفوض.");
    setWarn(""); if (!rows.some((r) => r.host === t.host && r.port === t.port)) save([...rows, { name: label.trim().slice(0, 60), ...t }]);
    setIp(""); setLabel("");
  };
  const testAll = async () => {
    setBusy(true);
    const next: Row[] = [];
    for (const r of rows) {
      try { const x = await reach({ data: { host: r.host, port: r.port } }); next.push({ ...r, ok: x.ok && x.data.reachable, model: x.ok ? x.data.model : "", result: x.ok ? (x.data.reachable ? `يصل (${x.data.ms} ms)${x.data.hikvision ? " · Hikvision" : ""}` : "لا يصل") : x.error }); }
      catch { next.push({ ...r, ok: false, result: "تعذر الاختبار" }); }
    }
    setRows(next); setBusy(false);
  };
  return (
    <div className="ac-stack">
      <Button onClick={() => void go("login")}>ربط Tailscale (أجهزة الفروع)</Button>
      {open ? (
        <div className="ac-card ac-stack">
          {note ? <p className="ac-message">{note}</p> : null}
          {warn ? <p className="ac-error">{warn}</p> : null}
          <p>رابط الموقع: <bdi dir="ltr">{TAILSCALE_PAGES.login}</bdi></p>
          <div className="ac-toolbar">
            <Button onClick={() => copy(TAILSCALE_PAGES.login)}>نسخ الرابط</Button>
            <Button onClick={() => void go("login")}>فتح في نافذة خاصة</Button>
            <Button onClick={() => void go("machines")}>صفحة الأجهزة (Machines)</Button>
          </div>
          <ol className="ac-muted">
            <li>سجّل الدخول في موقع Tailscale بحسابك.</li>
            <li>من Machines افتح كل كمبيوتر فرع ← Edit route settings ← فعّل مسار البصمة (مثال 192.168.1.2/32) ← Save.</li>
            <li>اكتب عنوان كل بصمة هنا تحت واضغط «اختبار الكل».</li>
          </ol>
          <div className="ac-toolbar">
            <input dir="ltr" placeholder="192.168.1.2" value={ip} onChange={(e) => setIp(e.target.value)} />
            <input placeholder="اسم الفرع (اختياري)" value={label} onChange={(e) => setLabel(e.target.value)} />
            <Button onClick={add}>إضافة عنوان</Button>
            <Button primary disabled={busy || !rows.length} onClick={() => void testAll()}>{busy ? "جارٍ الاختبار…" : "اختبار الكل"}</Button>
          </div>
          {rows.map((r) => (
            <p key={r.host + r.port}>
              <bdi dir="ltr">{r.host}:{r.port}</bdi>{r.name ? <> · {r.name}</> : null}{r.result ? <> · {r.result}</> : null}{" "}
              <Button onClick={() => onPick({ ip: r.host, httpPort: r.port, model: r.model || "", peer: r.name })}>إضافة الجهاز</Button>{" "}
              <Button onClick={() => save(rows.filter((x) => x !== r))}>حذف</Button>
            </p>
          ))}
          <p className="ac-muted">البرنامج لا يحفظ أي إيميل أو حساب Tailscale، ولا يشغّل Tailscale على هذا الكمبيوتر. لازم الكمبيوتر اللي عليه البرنامج يكون متصل بنفس حساب Tailscale وقابل لشبكات الفروع. الاختبار قراءة فقط ولا يرسل كلمات مرور.</p>
        </div>
      ) : null}
    </div>
  );
}

/** Read-only "اختبار الوصول" for a device address. */
export function ReachButton({ host, port }: { host: string; port: number }) {
  const reach = useServerFn(reachDeviceFn);
  const [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  return (
    <span>
      <Button disabled={busy || !host.trim()} onClick={async () => {
        setBusy(true); setMsg("");
        try { const r = await reach({ data: { host, port } }); setMsg(r.ok ? (r.data.reachable ? `يصل (${r.data.ms} ms)${r.data.hikvision ? " · جهاز Hikvision" : ""}` : "لا يصل. تأكد من ربط Tailscale وقبول شبكة الفرع.") : r.error); }
        catch { setMsg("تعذر الاختبار."); } finally { setBusy(false); }
      }}>{busy ? "جارٍ الاختبار…" : "اختبار الوصول"}</Button>
      {msg ? <span className="ac-muted"> {msg}</span> : null}
    </span>
  );
}
