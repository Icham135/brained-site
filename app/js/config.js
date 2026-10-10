// Brained – Konfiguration
// Leer lassen = Demo-Modus (lokal, Demo-Community). Ausgefüllt = echtes Backend (Supabase).
// Die Werte findest du in Supabase → Project Settings → API. Der «anon public» Key darf in der App stehen
// (Sicherheit kommt über Row Level Security in supabase/schema.sql).
export const CONFIG = {
  SUPABASE_URL: 'https://hsjceeclecvkjbusabpg.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzamNlZWNsZWN2a2pidXNhYnBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMDM2ODIsImV4cCI6MjEwNjc3OTY4Mn0.4zhWeftVx5uHyGECeih3y6aC0LKak7KMoVXTJZNy2Do', // öffentlich (anon), Schutz via RLS
  WEB_URL: 'https://icham135.github.io/brained-site/app/',                 // öffentliche Web-Adresse (für Einladungslinks), z.B. 'https://brained.app/'
  APP_SCHEME: 'ch.brained.app', // iOS/Android Deep-Link (Login-Rückkehr): ch.brained.app://auth
  LEGAL_EMAIL: 'learn.brained@gmail.com',
  OAUTH: ['apple', 'google'],  // in Supabase eingerichtet (Apple: scripts/apple-login-secret.mjs, Google: GOOGLE_CLIENT_ID in .env)
  ADS_ENABLED: false,          // erst aktivieren, wenn AdMob eingerichtet ist
  PRO_ENABLED: false,          // Brained Pro (Abo) anzeigen – erst einschalten, wenn Kauf in den Stores (RevenueCat) + Web (Stripe) eingerichtet ist (Server: PRO_SALES=on)
  VAPID_PUBLIC_KEY: 'BN43oX5LOiqCNS68BGW9G2tjG-yNcqjhFZc_rZnX3AwByaqDGw5jOoY8WDEIeYx26Ok3Xd1zigSDxMS-whUBp0E', // öffentlich – für Push-Erinnerungen (privater Teil liegt nur auf dem Server)
  REVENUECAT_IOS_KEY: '',      // RevenueCat → Project → API keys (Apple, beginnt mit appl_)
  REVENUECAT_ANDROID_KEY: '',  // RevenueCat → Project → API keys (Google, beginnt mit goog_)
};
// ?test (UI-Test-Suite) und ?demo laufen immer lokal im Demo-Modus – keine Testdaten in der echten Datenbank
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
export const SHOWCASE = q.get('showcase'); // Screenshots/Website: ?showcase=home|stats|trophies|rank|ai|exam|timer|profile
export const DEMO_FORCED = q.has('test') || q.has('demo') || !!SHOWCASE;
export const BACKEND = !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) && !DEMO_FORCED;
