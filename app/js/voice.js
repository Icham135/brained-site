// Sprachmemo → Text (Erklär's Brainy). Datenschutz: Es wird KEINE Audiodatei gespeichert oder an Brained geschickt.
// iPhone/Android: Spracherkennung des Betriebssystems (Apple Speech / Google). Im Browser: Web Speech API, falls vorhanden.
// Nur der erkannte Text landet im Eingabefeld – erst beim Senden geht er an Brainy.
import { lang } from './i18n.js';

const native = () => !!window.Capacitor?.isNativePlatform?.() && !!window.Capacitor?.Plugins?.SpeechRecognition;
const WebSR = () => window.SpeechRecognition || window.webkitSpeechRecognition;
const locale = () => ({ de: 'de-CH', fr: 'fr-CH', it: 'it-CH', en: 'en-US' }[lang] || 'de-CH');

export const voiceSupported = () => native() || !!WebSR();

let webRec = null, listener = null, active = false;
export const listening = () => active;

// onText(text) wird laufend mit dem bisher erkannten Text aufgerufen; onEnd() wenn fertig
export async function startVoice(onText, onEnd) {
  if (active) return;
  if (native()) {
    const SR = window.Capacitor.Plugins.SpeechRecognition;
    const { available } = await SR.available();
    if (!available) throw new Error('Spracherkennung ist auf diesem Gerät nicht verfügbar.');
    let perm = await SR.checkPermissions();
    if (perm.speechRecognition !== 'granted') perm = await SR.requestPermissions();
    if (perm.speechRecognition !== 'granted') throw new Error('Bitte erlaube Mikrofon & Spracherkennung in den Einstellungen.');
    listener = await SR.addListener('partialResults', d => { if (d?.matches?.[0]) onText(d.matches[0]); });
    await SR.addListener('listeningState', d => { if (d?.status === 'stopped') finish(onEnd); });
    active = true;
    await SR.start({ language: locale(), maxResults: 1, partialResults: true, popup: false });
    return;
  }
  const C = WebSR(); if (!C) throw new Error('Spracherkennung wird hier nicht unterstützt.');
  webRec = new C(); webRec.lang = locale(); webRec.interimResults = true; webRec.continuous = true;
  let finalText = '';
  webRec.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finalText += r[0].transcript + ' '; else interim += r[0].transcript; }
    onText((finalText + interim).trim());
  };
  webRec.onerror = () => finish(onEnd);
  webRec.onend = () => finish(onEnd);
  active = true; webRec.start();
}
async function finish(onEnd) {
  if (!active) return;
  active = false;
  try { await listener?.remove(); } catch { }
  try { await window.Capacitor?.Plugins?.SpeechRecognition?.removeAllListeners(); } catch { }
  listener = null; webRec = null; onEnd?.();
}
export async function stopVoice(onEnd) {
  try { if (native()) await window.Capacitor.Plugins.SpeechRecognition.stop(); else webRec?.stop(); } catch { }
  await finish(onEnd);
}
