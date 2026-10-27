# تعديل ربط Tailscale

الزرار «ربط Tailscale» يفتح https://login.tailscale.com/login في نافذة خاصة فاضية، من غير الحساب المحفوظ على الجهاز.

1. من صفحة الريبو اضغط Code ثم Download ZIP.
2. فك الضغط. هتلاقي فولدر فيه apply.ps1 ومجلد src.
3. في PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\PC HP\Downloads\speed-tailscale-login-fix-main\apply.ps1"
```

غيّر المسار لو الفولدر اتفك في مكان تاني. السكربت ينسخ الملفات الأربعة داخل:

C:\SpeedForTraining-1.1.9-Full-Docs-Source\source

ويعيد بناء ملف exe. ثبّت الملف الجديد من releases\windows.
