// Notfall-Anzeige: Falls die App nicht startet, Fehler zeigen statt weisser Seite.
// Eigene Datei (statt Inline-Skript), damit die Content-Security-Policy ohne 'unsafe-inline' für Skripte auskommt.
(function () {
  var errs = [];
  window.addEventListener('error', function (e) { errs.push((e.message || 'Fehler') + (e.filename ? ' (' + e.filename.split('/').pop() + ':' + e.lineno + ')' : '')); });
  window.addEventListener('unhandledrejection', function (e) { errs.push(String(e.reason && e.reason.message || e.reason)); });
  function el(tag, css, text) { var n = document.createElement(tag); if (css) n.style.cssText = css; if (text) n.textContent = text; return n; }
  setTimeout(function () {
    if (window.__booted) return;
    var d = el('div', 'position:fixed;inset:0;z-index:99999;background:#FFF0F5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:30px;text-align:center;font-family:-apple-system,system-ui,sans-serif;color:#16131F');
    d.appendChild(el('div', 'font-size:54px', '🧠'));
    d.appendChild(el('b', 'font-size:20px', 'Brained lädt nicht richtig'));
    d.appendChild(el('div', 'color:#57536A;font-size:15px', 'Prüfe deine Internetverbindung und lade neu.'));
    var b1 = el('button', 'background:#FF4F87;color:#fff;border:0;border-radius:999px;padding:14px 28px;font-weight:800;font-size:16px', 'Neu laden');
    b1.addEventListener('click', function () { location.reload(); });
    var b2 = el('button', 'background:none;border:0;color:#57536A;text-decoration:underline;font-size:14px', 'Lokale Daten zurücksetzen (Konto bleibt erhalten)');
    b2.addEventListener('click', function () { try { localStorage.removeItem('brained.v1'); } catch (e) { } location.reload(); });
    d.appendChild(b1); d.appendChild(b2);
    if (errs.length) d.appendChild(el('code', 'font-size:11px;color:#9893A8;max-width:320px;word-break:break-word', errs.slice(0, 3).join(' | ')));
    document.body.appendChild(d);
  }, 9000);
})();
