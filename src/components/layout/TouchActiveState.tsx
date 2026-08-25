"use client";

import { useEffect } from "react";

/**
 * Makes `:active` fire on touch in iOS Safari.
 *
 * Every pressed state in this project is CSS — see the "Pressed feedback"
 * block in `globals.css`. Android Chrome applies `:active` to a touch on its
 * own. iOS Safari, long-standingly, only does so when the element or one of
 * its ancestors has a touch listener attached; without one it skips the
 * pressed state entirely and a tap looks like nothing happened, which is the
 * behaviour this was reported as.
 *
 * A single passive, empty listener on `document` satisfies that condition for
 * the whole page. It handles no events and cancels nothing — `passive: true`
 * guarantees it can never block a scroll — so it costs one listener and
 * changes no behaviour beyond letting the CSS run.
 *
 * NOTE: this cannot be verified in headless Chromium, which never applies
 * `:active` to synthetic touch events at all, with or without a listener. The
 * pressed rules themselves are verified through a pointer press.
 */
export function TouchActiveState() {
  useEffect(() => {
    const noop = () => {};
    document.addEventListener("touchstart", noop, { passive: true });
    return () => document.removeEventListener("touchstart", noop);
  }, []);

  return null;
}
