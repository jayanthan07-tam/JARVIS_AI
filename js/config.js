// Central place for app-wide constants. Nothing here is a secret.

export const ROUTES = [
  { id: "home", label: "Home", short: "Home", icon: "home", mobile: true, title: "Home" },
  { id: "voice", label: "Voice Assistant", short: "Voice", icon: "voice", mobile: true, title: "Voice Assistant" },
  { id: "gestures", label: "Gesture Control", short: "Gestures", icon: "gesture", mobile: true, title: "Gesture Control" },
  { id: "chat", label: "AI Chat", short: "Chat", icon: "chat", mobile: true, title: "AI Chat" },
  { id: "system", label: "System Control", short: "System", icon: "system", mobile: false, title: "System Control" },
  { id: "settings", label: "AI Settings", short: "Settings", icon: "settings", mobile: true, title: "AI Settings" },
];

// Connection status is hard-wired to "not connected" in this milestone.
// Change these only when the matching backend or device integration exists.
export const CONNECTIONS = {
  backend: { label: "Backend", value: "OFFLINE", state: "off", detail: "No FastAPI server connected" },
  camera: { label: "Camera", value: "NOT CONNECTED", state: "off", detail: "Demo feed only" },
  microphone: { label: "Microphone", value: "NOT CONNECTED", state: "off", detail: "Demo audio only" },
  ai: { label: "AI provider", value: "NOT CONFIGURED", state: "off", detail: "Replies are canned demo text" },
};

export const WS_URL = "ws://localhost:8000/stream";
export const CHAT_MAX_CHARS = 4000;
export const STORAGE_KEY = "jarvis.ui.settings.v1";
