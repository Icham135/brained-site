// Flüchtiger UI-Zustand (nicht persistiert).

export const U = {
  booted: false,
  tab: 'home',
  overlay: null,          // 'timer' | 'summary' | 'profile'
  standby: false,
  sheet: null,            // { type, ...data }
  modal: null,            // { type, ...data }
  toast: null,
  onb: {
    step: 'intro', poke: 0, load: 0, mode: 'signup',
    d: { name: '', username: '', email: '', country: '', region: '', canton: 'ZH', level: 'gym', avatar: { skin: 'pink', mood: 'happy', bg: 'ffd5dc' }, subjects: ['mathe', 'deutsch', 'franz', 'englisch', 'bio'], goalH: 10, checkinMin: 60, demo: true, google: false, quiz: {} },
  },
  setup: { subjectId: null, mode: 'free', goalMin: 60 },
  rankScope: 'global', rankPeriod: 'week', rankCanton: '', rankGroup: null,
  summary: null,
  form: {},               // gebundene Formularwerte (data-bind="form.x")
  ai: { tool: null },
  aiInsights: null,
};
