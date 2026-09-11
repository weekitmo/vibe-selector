/**
 * Vibe Selector — MAIN-world picker bootstrap.
 *
 * Loaded after picker/host-adapter.js and picker/editor.js by the service
 * worker (strict file order: host-adapter → editor → inject). editor.js is the
 * picker IIFE and self-initializes on evaluation; this file only wires the
 * SW-dispatched action events (chrome.commands shortcuts) into the picker's
 * own MAIN-world key handling.
 *
 * How shortcut dispatch works:
 *   chrome.commands (Alt+Shift+C / X / M) → SW → shim → CustomEvent on window
 *   → here → synthesize a KeyboardEvent with the binding the picker recorded
 *   → the picker's document-level capture keydown handler processes it exactly
 *   as if the user pressed it (all its guards apply: needs a selection, etc).
 *
 * ⌘C / ⌘M / ⌘⇧C typed directly in the page are handled natively by the
 * picker's own keydown path (pageShortcuts=true, settings.shortcut* bindings).
 */
(() => {
  "use strict";

  function press(binding) {
    if (!binding) return;
    const parts = String(binding).split("+").map(s => s.trim()).filter(Boolean);
    const key = parts[parts.length - 1];
    const mod = parts.some(p => /^(Mod|Command|Cmd|Ctrl|Control)$/i.test(p));
    const alt = parts.some(p => /^(Alt|Option)$/i.test(p));
    const shift = parts.includes("Shift");
    const code = /^Key[A-Z]$/.test(key) ? key : (/^[a-z]$/i.test(key) ? "Key" + key.toUpperCase() : key);
    const event = new KeyboardEvent("keydown", {
      key,
      code,
      metaKey: mod,
      ctrlKey: mod,
      altKey: alt,
      shiftKey: shift,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
  }

  function currentBindings() {
    const s = (window.__SELECTOR_HOST__ && window.__SELECTOR_HOST__.initialSettings) || {};
    return {
      "copy-context": s.shortcutCopyContext || "Mod+C",
      "screenshot-context": s.shortcutScreenshotContext || "Mod+Shift+C",
      "copy-markdown": s.shortcutMarkdown || "Mod+M",
    };
  }

  window.addEventListener("vibe:action", (event) => {
    const action = event.detail && event.detail.action;
    const bindings = currentBindings();
    if (bindings[action]) press(bindings[action]);
  });
})();
