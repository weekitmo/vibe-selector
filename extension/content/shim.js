/**
 * Vibe Selector — ISOLATED-world shim.
 *
 * Lives in every page where the picker has been activated. Jobs:
 *
 * 1. Bridge JSON-RPC from the MAIN-world picker (via window.postMessage) to
 *    the extension service worker (chrome.runtime.sendMessage) and back.
 *
 * 2. Forward SW actions (toggle / chrome.commands shortcuts) into the MAIN
 *    world as DOM events the picker layer listens for.
 *
 * 3. Mirror synced settings into sessionStorage BEFORE the SW injects the
 *    MAIN payload — the MAIN world cannot read chrome.storage, and the
 *    the picker reads its settings synchronously at IIFE eval time.
 *    This part runs on EVERY injection; the bridge below installs once.
 */
(() => {
  "use strict";
  const RPC_REQ = "vibe-rpc-request";
  const RPC_RES = "vibe-rpc-response";

  // ── Host settings mirror (every injection) ────────────────
  async function writeHostMirror() {
    try {
      const reply = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: "vibe-rpc", id: "boot-" + Date.now(), method: "session.boot", params: {} },
          (res) => { void chrome.runtime.lastError; resolve(res); },
        );
      });
      const data = (reply && reply.ok && reply.data) || {};
      sessionStorage.setItem("vibe-host-mirror", JSON.stringify({
        settings: data.settings || {},
        lang: data.lang || "",
        activationShortcut: (data.shortcuts && data.shortcuts["_execute_action"]) || "",
      }));
    } catch (_) {}
  }
  writeHostMirror();
  // Second write covers the race where SW injected shim+MAIN back-to-back with
  // the first mirror still in flight (150ms gap covers it; this is a backstop).
  setTimeout(writeHostMirror, 50);

  if (window.__VIBE_SHIM__) return; // bridge already installed
  window.__VIBE_SHIM__ = true;

  // ── MAIN → SW RPC bridge (once per page) ─────────────────
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.type !== RPC_REQ) return;
    const id = msg.id;
    try {
      chrome.runtime.sendMessage(
        { type: "vibe-rpc", id, method: msg.method, params: msg.params },
        (reply) => {
          const err = chrome.runtime.lastError;
          window.postMessage(
            {
              type: RPC_RES, id,
              ok: !err && reply && reply.ok,
              data: (!err && reply && reply.data) || null,
              error: err ? { message: err.message } : ((reply && reply.error) || { message: "rpc failed" }),
            },
            window.location.origin,
          );
        },
      );
    } catch (err) {
      window.postMessage({ type: RPC_RES, id, ok: false, data: null, error: { message: String(err) } }, window.location.origin);
    }
  });

  // ── SW → page actions (toggle / shortcut dispatch) ────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg.type !== "string") return false;
    if (msg.type === "vibe-toggle") {
      window.dispatchEvent(new CustomEvent("vibe:toggle"));
      sendResponse({ ok: true });
      return true;
    }
    if (msg.type === "vibe-action") {
      window.dispatchEvent(new CustomEvent("vibe:action", { detail: { action: msg.action } }));
      sendResponse({ ok: true });
      return true;
    }
    return false;
  });

  // ── Heartbeat: tell the SW we are alive every 60s ─────────
  const ping = () => {
    try {
      chrome.runtime.sendMessage({ type: "vibe-rpc", id: "hb-" + Date.now(), method: "session.heartbeat", params: { open: true } }, () => void chrome.runtime.lastError);
    } catch (_) {}
  };
  ping();
  setInterval(ping, 60_000);

  // ── SPA navigation watchdog ───────────────────────────────
  // history.pushState / replaceState do NOT unload this shim, but the page's
  // UI state (and the picker's selection) belongs to the old route. Detect
  // href changes and notify the MAIN world so the picker can reset itself.
  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      window.dispatchEvent(new CustomEvent("vibe:navigation"));
      ping();
    }
  }, 1000);
})();
