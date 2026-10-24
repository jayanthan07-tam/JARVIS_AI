// Inline SVG icons (stroke-based, 24px grid). No external icon font needed.
const PATHS = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  voice: '<path d="M4 10v4M8 6v12M12 3v18M16 8v8M20 10v4"/>',
  gesture: '<path d="M7 12V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M10 11V4a1.5 1.5 0 0 1 3 0v7"/><path d="M13 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M16 11V8a1.5 1.5 0 0 1 3 0v6a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4.5 14a1.5 1.5 0 0 1 2.2-2L7 13"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  system: '<rect x="3" y="4" width="18" height="12"/><path d="M8 20h8M12 16v4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  send: '<path d="M4 12h14M13 6l6 6-6 6"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  lock: '<rect x="5" y="11" width="14" height="9"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  stop: '<rect x="6" y="6" width="12" height="12"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  terminal: '<rect x="3" y="4" width="18" height="16"/><path d="M7 9l3 3-3 3M13 15h4"/>',
  flask: '<path d="M9 3h6M10 3v6L4.5 18.5A1.5 1.5 0 0 0 5.8 21h12.4a1.5 1.5 0 0 0 1.3-2.5L14 9V3"/>',
  pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/>',
  hand: '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v6a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4.5 14a1.5 1.5 0 0 1 2.2-2L8 13"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  cpu: '<rect x="6" y="6" width="12" height="12"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  power: '<path d="M12 3v9"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/>',
  fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 2-6 5-6 0 3-2 6-5 6zM14 12c4 0 6 2 6 5-3 0-6-2-6-5zM12 14c0 4-2 6-5 6 0-3 2-6 5-6zM10 12c-4 0-6-2-6-5 3 0 6 2 6 5z"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  waveform: '<path d="M2 12h2M6 8v8M10 4v16M14 7v10M18 9v6M22 12h-2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};

export function icon(name, extraClass = "") {
  const body = PATHS[name] ?? "";
  return `<svg class="icon ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
