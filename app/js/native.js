import { CONFIG } from './config.js';
// Native Brücke (Capacitor). Im Browser sind alle Funktionen harmlose No-ops.
const P = () => window.Capacitor?.Plugins || {};
export const isNative = () => !!window.Capacitor?.isNativePlatform?.();
export const platform = () => window.Capacitor?.getPlatform?.() || 'web';

export function initNative({ onBack, dark }) {
  if (!isNative()) return;
  try { P().SplashScreen?.hide(); } catch { }
  try { P().StatusBar?.setStyle({ style: dark ? 'DARK' : 'LIGHT' }); } catch { }
  // Android: Zurück-Taste schliesst zuerst Sheets/Overlays, statt die App zu beenden
  try { P().App?.addListener('backButton', () => { if (!onBack()) P().App.minimizeApp(); }); } catch { }
  // Tastatur offen → Tab-Leiste ausblenden (sonst schwebt sie über dem Inhalt)
  try { P().Keyboard?.addListener('keyboardWillShow', () => kb(true)); P().Keyboard?.addListener('keyboardWillHide', () => kb(false)); } catch { }
}
const kb = on => document.documentElement.classList.toggle('kb', on);
// Fallback (Browser/PWA & falls das Plugin fehlt): Fokus in einem Textfeld = Tastatur offen
const typing = el => el?.matches?.('textarea, input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=button]):not([type=submit]), [contenteditable]');
if (typeof document !== 'undefined' && matchMedia('(pointer: coarse)').matches) {
  document.addEventListener('focusin', e => { if (typing(e.target)) kb(true); });
  document.addEventListener('focusout', e => { if (typing(e.target)) setTimeout(() => { if (!typing(document.activeElement)) kb(false); }, 60); });
}
export function setStatusBar(dark) { try { P().StatusBar?.setStyle({ style: dark ? 'DARK' : 'LIGHT' }); } catch { } }
export function hapticNative(ms) {
  const H = P().Haptics; if (!H) return false;
  try { ms >= 40 ? H.notification({ type: 'SUCCESS' }) : H.impact({ style: ms >= 20 ? 'MEDIUM' : 'LIGHT' }); } catch { }
  return true;
}
// Bildschirm wach halten (Fokus-Modus) – WKWebView kennt die Web-Wake-Lock-API nicht
export async function keepAwakeNative(on) {
  const K = P().KeepAwake; if (!K) return null;
  try { on ? await K.keepAwake() : await K.allowSleep(); return true; } catch { return false; }
}

// Mond-Modus: Bildschirm auf Minimum dimmen (nur native App – Websites dürfen die Helligkeit nicht ändern).
// Hinweis: Den System-Stromsparmodus oder «Nicht stören» darf keine App selbst einschalten (iOS & Android) –
// dafür zeigt die App eine Anleitung.
let prevBrightness = null;
export async function dimNative(on) {
  const B = P().ScreenBrightness; if (!B) return false;
  try {
    if (on) { prevBrightness = (await B.getBrightness()).brightness; await B.setBrightness({ brightness: 0.02 }); }
    else await B.setBrightness({ brightness: platform() === 'android' ? -1 : (prevBrightness ?? 0.6) });
    return true;
  } catch { return false; }
}

// Abos in den Store-Apps über RevenueCat (App Store / Google Play). App User ID = Supabase-User-ID,
// damit der Webhook den Kauf dem richtigen Konto zuordnet.
const rcKey = () => platform() === 'ios' ? CONFIG.REVENUECAT_IOS_KEY : platform() === 'android' ? CONFIG.REVENUECAT_ANDROID_KEY : '';
export const nativeBillingReady = () => isNative() && !!rcKey() && !!P().Purchases;
let rcConfigured = false;
export async function nativePurchase(plan, userId) {
  const RC = P().Purchases;
  if (!rcConfigured) { await RC.configure({ apiKey: rcKey(), appUserID: userId }); rcConfigured = true; }
  const { current } = await RC.getOfferings();
  const pkg = plan === 'yearly' ? current?.annual : current?.monthly;
  if (!pkg) throw new Error('Abo ist im Store noch nicht eingerichtet.');
  await RC.purchasePackage({ aPackage: pkg });
}
export async function nativeRestore(userId) {
  const RC = P().Purchases;
  if (!rcConfigured) { await RC.configure({ apiKey: rcKey(), appUserID: userId }); rcConfigured = true; }
  await RC.restorePurchases();
}
