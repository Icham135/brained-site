// Neue Shop-Items (reine Daten, keine Importe). js/data.js hängt sie an SHOP_ITEMS, BRAIN_SKINS, SHOP_FRAMES, SHOP_BUNDLES und SHOP_CONSUMABLES an,
// scripts/migrate.mjs liest sie von dort (Preise liegen serverseitig als Quelle der Wahrheit).
// Preise: 1 Lernminute = 1 Coin. Gewöhnlich 100–350 (≈ 2–6 h), selten 400–800, episch 900–2000, legendär 2500–4000.
// price 0 = Starter (gehört allen), pro = Pro-Item. Keine Sets: jedes Teil ist ein eigenes Item.
const N = '2026-10'; // «Neu im Shop»-Monat

export const SLOT_LABELS = {
  hat: 'Hüte', eyes: 'Brillen', mouth: 'Münder', extra: 'Extras', aura: 'Auren', bgfx: 'Hintergründe', effect: 'Effekte',
};

export const NEW_ITEMS = [
  // Hüte
  { id: 'beanie', slot: 'hat', name: 'Wollmütze', rar: 'common', price: 120, added: N },
  { id: 'bunny', slot: 'hat', name: 'Hasenohren', rar: 'common', price: 110, added: N },
  { id: 'cat', slot: 'hat', name: 'Katzenohren', rar: 'common', price: 150, added: N },
  { id: 'chef', slot: 'hat', name: 'Kochmütze', rar: 'common', price: 180, added: N },
  { id: 'cowboy', slot: 'hat', name: 'Cowboyhut', rar: 'rare', price: 500, added: N },
  { id: 'flowers', slot: 'hat', name: 'Blumenkranz', rar: 'rare', price: 700, added: N },
  { id: 'horns', slot: 'hat', name: 'Teufelshörner', rar: 'rare', price: 800, added: N },
  { id: 'viking', slot: 'hat', name: 'Wikingerhelm', rar: 'epic', price: 2200, added: N },
  { id: 'unicorn', slot: 'hat', name: 'Einhorn-Horn', rar: 'legend', price: 12000, req: { streak: 30 }, added: N },
  // Brillen
  { id: 'g3d', slot: 'eyes', name: '3D-Brille', rar: 'common', price: 90, added: N },
  { id: 'patch', slot: 'eyes', name: 'Augenklappe', rar: 'common', price: 80, added: N },
  { id: 'starglass', slot: 'eyes', name: 'Sternbrille', rar: 'rare', price: 500, added: N },
  { id: 'vr', slot: 'eyes', name: 'VR-Brille', rar: 'epic', price: 2300, added: N },
  { id: 'laser', slot: 'eyes', name: 'Laser-Augen', rar: 'legend', price: 11000, req: { streak: 30 }, added: N },
  // Münder
  { id: 'tongue', slot: 'mouth', name: 'Zunge', rar: 'common', price: 0, added: N },
  { id: 'lipstick', slot: 'mouth', name: 'Lippenstift', rar: 'common', price: 120, added: N },
  { id: 'fangs', slot: 'mouth', name: 'Vampirzähne', rar: 'rare', price: 600, added: N },
  { id: 'beard', slot: 'mouth', name: 'Zottelbart', rar: 'rare', price: 750, added: N },
  // Extras
  { id: 'scarf', slot: 'extra', name: 'Wollschal', rar: 'common', price: 0, added: N },
  { id: 'medal', slot: 'extra', name: 'Medaille', rar: 'rare', price: 600, added: N },
  { id: 'pearls', slot: 'extra', name: 'Perlenkette', rar: 'rare', price: 850, added: N },
  { id: 'cape', slot: 'extra', name: 'Heldenumhang', rar: 'epic', price: 2800, added: N },
  { id: 'wings', slot: 'extra', name: 'Engelsflügel', rar: 'epic', price: 3100, added: N },
  // Auren (animiert, laufen rund ums Gehirn)
  { id: 'a-snow', slot: 'aura', name: 'Schneefall', rar: 'rare', price: 850, added: N },
  { id: 'a-sakura', slot: 'aura', name: 'Kirschblüte-Aura', rar: 'rare', price: 900, added: N },
  { id: 'a-water', slot: 'aura', name: 'Wasser-Aura', rar: 'epic', price: 3000, added: N },
  { id: 'a-stardust', slot: 'aura', name: 'Sternenstaub', rar: 'epic', price: 3500, added: N },
  { id: 'a-glitch', slot: 'aura', name: 'Pixel-Glitch', rar: 'epic', price: 3600, added: N },
  { id: 'a-ghost', slot: 'aura', name: 'Geist-Nebel', rar: 'epic', price: 3200, added: N },
  { id: 'a-fire', slot: 'aura', name: 'Feuergeist-Aura', rar: 'epic', price: 3600, added: N },
  { id: 'a-lightning', slot: 'aura', name: 'Blitz', rar: 'epic', price: 3700, added: N },
  { id: 'a-aurora', slot: 'aura', name: 'Nordlicht', rar: 'epic', price: 3800, added: N },
  { id: 'a-rainbow', slot: 'aura', name: 'Regenbogen-Aura', rar: 'legend', price: 14500, req: { league: 'Platin I' }, added: N },
  { id: 'a-gold', slot: 'aura', name: 'Gold-Schimmer', rar: 'legend', price: 0, pro: true, month: 'November', added: N },
  // Hintergründe (animiert in der Avatar-Scheibe)
  { id: 'bg-sunset', slot: 'bgfx', name: 'Abendrot', rar: 'common', price: 140, added: N },
  { id: 'bg-bubbles', slot: 'bgfx', name: 'Blubberblasen', rar: 'common', price: 160, added: N },
  { id: 'bg-rain', slot: 'bgfx', name: 'Regenstimmung', rar: 'rare', price: 450, added: N },
  { id: 'bg-stars', slot: 'bgfx', name: 'Sternenhimmel', rar: 'rare', price: 550, added: N },
  { id: 'bg-snow', slot: 'bgfx', name: 'Schneegestöber', rar: 'rare', price: 550, added: N },
  { id: 'bg-sakura', slot: 'bgfx', name: 'Kirschblüten', rar: 'rare', price: 600, added: N },
  { id: 'bg-matrix', slot: 'bgfx', name: 'Pixelregen', rar: 'epic', price: 2000, added: N },
  { id: 'bg-aurora', slot: 'bgfx', name: 'Polarlicht', rar: 'epic', price: 2300, added: N },
  // Effekte (Feier-Animationen am Ende einer Session, Etappe oder Streak-Meilenstein)
  { id: 'e-confetti', slot: 'effect', name: 'Konfetti', rar: 'common', price: 0, icon: '🎉', added: N },
  { id: 'e-snow', slot: 'effect', name: 'Schneefall', rar: 'rare', price: 750, icon: '❄️', added: N },
  { id: 'e-sakura', slot: 'effect', name: 'Blütenregen', rar: 'rare', price: 850, icon: '🌸', added: N },
  { id: 'e-fire', slot: 'effect', name: 'Feuerstoss', rar: 'epic', price: 2500, icon: '🔥', added: N },
  { id: 'e-wave', slot: 'effect', name: 'Wasserwelle', rar: 'epic', price: 2500, icon: '🌊', added: N },
  { id: 'e-fireworks', slot: 'effect', name: 'Feuerwerk', rar: 'epic', price: 3200, icon: '🎆', added: N },
  { id: 'e-aurora', slot: 'effect', name: 'Aurora-Schleier', rar: 'legend', price: 8500, req: { streak: 14 }, icon: '🌌', added: N },
  { id: 'e-gold', slot: 'effect', name: 'Goldregen', rar: 'legend', price: 0, pro: true, month: 'November', icon: '🪙', added: N },
];

export const NEW_SKINS = [
  { id: 'grass', name: 'Gras', fill: '#D6F2B5', fold: '#6FB83A', rar: 'common', price: 0, added: N },
  { id: 'sand', name: 'Sand', fill: '#F5E6C8', fold: '#C79B5A', rar: 'common', price: 0, added: N },
  { id: 'candy', name: 'Zuckerwatte', fill: '#FFC8F0', fold: '#5FC8FF', rar: 'rare', price: 650, fx: 'shine', added: N },
  { id: 'sakura', name: 'Kirschblüte', fill: '#FFE4EE', fold: '#F08DB0', outline: '#6B2E48', rar: 'rare', price: 700, added: N },
  { id: 'ocean', name: 'Tiefsee', fill: '#9CE0F7', fold: '#1E88C7', outline: '#0F3B5C', rar: 'rare', price: 800, added: N },
  { id: 'midnight', name: 'Mitternacht', fill: '#2A3A6B', fold: '#8FB0FF', outline: '#0B1230', rar: 'rare', price: 850, fx: 'stars', added: N },
  { id: 'toxic', name: 'Gift-Gehirn', fill: '#C8FF4D', fold: '#2E8B00', outline: '#1B3300', rar: 'epic', price: 2600, fx: 'drip', added: N },
  { id: 'ember', name: 'Feuergeist', fill: '#FF9A5C', fold: '#B8260F', outline: '#3A0E06', rar: 'epic', price: 2900, fx: 'glow', added: N },
  { id: 'crystal', name: 'Kristall-Gehirn', fill: '#E0F4FF', fold: '#A07BFF', outline: '#3A2C7A', rar: 'epic', price: 3300, fx: 'shine', added: N },
  { id: 'ghost', name: 'Geist-Gehirn', fill: '#F4F7FF', fold: '#B5C4FF', outline: '#5A6A9E', rar: 'legend', price: 11500, req: { streak: 30 }, anim: 'ghost', added: N },
  { id: 'hologram', name: 'Hologramm', fill: '#B8F7FF', fold: '#FF8CF0', outline: '#2A5C7A', rar: 'legend', price: 14000, req: { league: 'Gold III' }, anim: 'hologram', added: N },
  { id: 'plasma', name: 'Plasma-Gehirn', fill: '#2A1670', fold: '#7DF9FF', outline: '#0A0524', rar: 'legend', price: 13000, req: { league: 'Gold III' }, anim: 'plasma', added: N },
  { id: 'magma', name: 'Magma-Gehirn', fill: '#4A1A0E', fold: '#FF8A1A', outline: '#150603', rar: 'legend', price: 11000, req: { streak: 21 }, anim: 'magma', added: N },
  { id: 'aurora', name: 'Aurora-Gehirn', fill: '#10305A', fold: '#5CFFB2', outline: '#06142B', rar: 'legend', price: 16000, req: { league: 'Platin I' }, anim: 'aurora', added: N },
];

export const NEW_FRAMES = [
  { id: 'f-water', name: 'Welle', rar: 'rare', price: 650, added: N },
  { id: 'f-sakura', name: 'Sakura', rar: 'rare', price: 700, added: N },
  { id: 'f-ice', name: 'Frost', rar: 'rare', price: 750, added: N },
  { id: 'f-pixel', name: 'Pixel', rar: 'epic', price: 2100, added: N },
  { id: 'f-aurora', name: 'Nordlicht', rar: 'epic', price: 2900, added: N },
  { id: 'f-bolt', name: 'Blitz', rar: 'epic', price: 3300, added: N },
  { id: 'f-royal', name: 'Royal-Gold', rar: 'legend', price: 0, pro: true, month: 'November', added: N },
];


export const NEW_CONSUMABLES = [
  { id: 'freeze3', name: 'Streak-Schutz ×3', emoji: '🧊', price: 650, qty: 3, added: N },
  { id: 'freeze7', name: 'Streak-Schutz ×7', emoji: '🧊', price: 1400, qty: 7, added: N },
];
