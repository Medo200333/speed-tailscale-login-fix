import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { tsDevicesFn, tsSwitchFn, reachDeviceFn } from "@/lib/tailscale.functions";
import { Button } from "./access-ui";

type Found = { ip: string; httpPort: number; model: string; peer: string };
type Device = { name: string; dns: string; ip: string; os: string; online: boolean };
type Snapshot = { state: string; account: string; displayName: string; selfName: string; selfIp: string; authUrl: string; devices: Device[] };

/** Reads devices from the Tailscale client installed on this PC. The website alone is not a connection. */
export function TailscaleLink({ onPick }: { onPick: (row: Found) => void }) {
  const load = useServerFn(tsDevicesFn), switchAccount = useServerFn(tsSwitchFn), reach = useServerFn(reachDeviceFn);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState("");

  const refresh = async () => {
    setBusy(true); setNote("");
    try {
      const r = await load({});
      if (!r.ok) { setNote(r.error); return; }
      setSnap(r.data);
      if (r.data.state && r.data.state !== "Running") setNote(r.data.state === "NeedsLogin" ? "Tailscale على الويندوز مش داخل على حساب. اضغط «تغيير الحساب» وسجّل بجيميل الشبكة." : `حالة Tailscale: ${r.data.state}`);
      else if (!r.data.devices.length) setNote("متصل، لكن مفيش أجهزة تانية ظاهرة على الحساب ده.");
    } catch { setNote("تعذر قراءة Tailscale."); }
    finally { setBusy(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const relog = async () => {
    setBusy(true); setNote("هيخرج الحساب الحالي من Tailscale على الويندوز ويفتح صفحة دخول جديدة…");
    try {
      const r = await switchAccount({});
      if (!r.ok) { setNote(r.error); return; }
      setNote(r.data.opened ? "اتفتحت صفحة الدخول في نافذة خاصة. سجّل بالجيميل المطلوب، وبعدين اضغط «تحديث الأجهزة»." : r.data.url ? `افتح الرابط في نافذة خاصة ثم حدّث: ${r.data.url}` : "اتعمل خروج. افتح برنامج Tailscale وسجّل الدخول، ثم اضغط تحديث.");
    } catch { setNote("تعذر تغيير الحساب."); }
    finally { setBusy(false); }
  };

  return (
    <div className="ac-stack">
      <div className="ac-toolbar">
        <Button primary disabled={busy} onClick={() => void refresh()}>{busy ? "جارٍ القراءة…" : "تحديث الأجهزة"}</Button>
        <Button disabled={busy} onClick={() => void relog()}>تغيير الحساب</Button>
      </div>
      {note ? <p className="ac-message">{note}</p> : null}
      {snap ? (
        <p>الحالة: {snap.state === "Running" ? "متصل" : snap.state || "غير معروف"}{snap.account ? <> · الحساب: <bdi dir="ltr">{snap.account}</bdi></> : null}{snap.displayName ? <> · {snap.displayName}</> : null} · هذا الجهاز: <bdi dir="ltr">{snap.selfName} {snap.selfIp}</bdi> · الأجهزة: {snap.devices.length}</p>
      ) : null}
      {snap?.devices.map((d) => (
        <p key={d.ip}>
          {d.online ? "متصل" : "غير متصل"} · {d.name}{d.os ? ` · ${d.os}` : ""} · <bdi dir="ltr">{d.ip}</bdi>{" "}
          <Button onClick={() => onPick({ ip: d.ip, httpPort: 80, model: "", peer: d.name })}>إضافة الجهاز</Button>{" "}
          <Button disabled={testing === d.ip} onClick={async () => {
            setTesting(d.ip);
            try {
              const r = await reach({ data: { host: d.ip, port: 80 } });
              setNote(r.ok ? (r.data.reachable ? `${d.name} يصل (${r.data.ms} ms)${r.data.hikvision ? " · Hikvision" : ""}` : `${d.name} لا يصل على منفذ 80`) : r.error);
            } catch { setNote("تعذر الاختبار."); }
            finally { setTesting(""); }
          }}>{testing === d.ip ? "جارٍ الاختبار…" : "اختبار الوصول"}</Button>
        </p>
      ))}
      <p className="ac-muted">القائمة دي من برنامج Tailscale على الويندوز، مش من صفحة الموقع. قفل صفحة الموقع لا يغيّر شيئاً. «تغيير الحساب» يخرج الحساب الحالي من كمبيوتر الويندوز حتى تسجّل بالحساب المطلوب.</p>
    </div>
  );
}

export function ReachButton({ host, port }: { host: string; port: number }) {
  const reach = useServerFn(reachDeviceFn);
  const [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  return (
    <span>
      <Button disabled={busy || !host.trim()} onClick={async () => {
        setBusy(true); setMsg("");
        try { const r = await reach({ data: { host, port } }); setMsg(r.ok ? (r.data.reachable ? `يصل (${r.data.ms} ms)${r.data.hikvision ? " · جهاز Hikvision" : ""}` : "لا يصل.") : r.error); }
        catch { setMsg("تعذر الاختبار."); } finally { setBusy(false); }
      }}>{busy ? "جارٍ الاختبار…" : "اختبار الوصول"}</Button>
      {msg ? <span className="ac-muted"> {msg}</span> : null}
    </span>
  );
}
