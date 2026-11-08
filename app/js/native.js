import { CONFIG, DEV } from './config.js';
import { PRO } from './data.js';
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
// damit der Webhook den Kauf dem richtigen Konto zuordnet. Berechtigung (Entitlement): «pro».
// Ohne Schlüssel in js/config.js (REVENUECAT_IOS_KEY / REVENUECAT_ANDROID_KEY) ist der Kauf in der App nicht bereit: die App zeigt dann einen freundlichen Hinweis.
// Schlüssel: nur appl_/goog_ aus js/config.js. Ein Test-Store-Schlüssel (test_…) gilt nur in der Entwicklung (DEV) und kommt lokal aus localStorage «brained.rcKey» (nie ins Repo); in Release-Builds wird er ignoriert, weil RevenueCat damit absichtlich abstürzt.
const rcKey = () => {
  let k = platform() === 'ios' ? CONFIG.REVENUECAT_IOS_KEY : platform() === 'android' ? CONFIG.REVENUECAT_ANDROID_KEY : '';
  if (!k && DEV) { try { k = localStorage.getItem('brained.rcKey') || ''; } catch { } }
  return /^test_/.test(k) && !DEV ? '' : k || '';
};
export const nativeBillingReady = () => isNative() && !!rcKey() && !!P().Purchases;
export const ENTITLEMENT = 'pro';
export const hasProEntitlement = info => !!info?.entitlements?.active?.[ENTITLEMENT];
let rcUser = null;
async function rcReady(userId) {
  const RC = P().Purchases; if (!RC || !rcKey()) throw new Error('Der Kauf ist in dieser Version noch nicht verfügbar.');
  if (rcUser === null) { await RC.configure({ apiKey: rcKey(), appUserID: userId }); rcUser = userId; }
  else if (rcUser !== userId) { await RC.logIn({ appUserID: userId }); rcUser = userId; }
  return RC;
}
// Pakete (Monat/Jahr) mit Preis aus dem Store. IDs: ch.brained.pro.monthly / ch.brained.pro.yearly (Fallback: Standard-Pakete des Angebots)
export async function nativeOfferings(userId) {
  const RC = await rcReady(userId), { current } = await RC.getOfferings(), all = current?.availablePackages || [];
  const pick = (id, std) => { const pkg = all.find(p => (p.product?.identifier || '').startsWith(id)) || std || null; return pkg ? { pkg, price: pkg.product?.priceString || '' } : null; };
  return { monthly: pick(PRO.productMonthly, current?.monthly), yearly: pick(PRO.productYearly, current?.annual) };
}
export async function nativePurchase(plan, userId) {
  const RC = await rcReady(userId), o = await nativeOfferings(userId), pkg = o[plan === 'yearly' ? 'yearly' : 'monthly']?.pkg;
  if (!pkg) throw new Error('Das Abo ist im Store noch nicht eingerichtet.');
  try { const r = await RC.purchasePackage({ aPackage: pkg }); return r?.customerInfo || null; }
  catch (e) { if (e?.userCancelled || /cancel/i.test(e?.message || '')) throw Object.assign(new Error('cancel'), { cancelled: true }); throw e; }
}
export async function nativeRestore(userId) {
  const RC = await rcReady(userId), r = await RC.restorePurchases();
  return r?.customerInfo || null;
}
// «Abo verwalten»: Abo-Seite des Stores (Kündigen dort)
export const manageUrl = () => platform() === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions';
export async function openExternal(url) {
  try { if (isNative() && P().Browser) return await P().Browser.open({ url }); } catch { }
  window.open(url, '_blank', 'noopener');
}
