import { ROUTES } from "./config.js";

const DEFAULT_ROUTE = "home";
const known = new Set(ROUTES.map((r) => r.id));

export function routeFromHash() {
  const id = location.hash.replace(/^#\/?/, "");
  return known.has(id) ? id : DEFAULT_ROUTE;
}

export function navigate(id) {
  if (!known.has(id)) return;
  if (location.hash === `#/${id}`) return;
  location.hash = `#/${id}`;
}

export function onRouteChange(callback) {
  const handler = () => callback(routeFromHash());
  window.addEventListener("hashchange", handler);
  handler();
  return () => window.removeEventListener("hashchange", handler);
}
