// Lightweight in-app signal that the current user's coin balance may have
// changed. Fired whenever a profile is (re)loaded after a coin-affecting action
// — shop buys, seed gifts, harvests, and habit logs all reload the profile —
// plus directly from the couple of widgets that don't.
//
// The always-visible coin pill (useCoinBalance) listens and refetches, so it
// updates immediately rather than waiting for a page refresh or a realtime
// event, which isn't reliably delivered in every environment.

const EVENT = "bloomgarden:coins-changed";

export function notifyCoinsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
}

export function onCoinsChanged(handler: () => void): () => void {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
