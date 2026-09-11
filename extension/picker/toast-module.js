// ── Toast feedback (vibe-selector extension only) ───────────
// The picker's built-in feedback mutates the panel's Copy button text, which
// is invisible when the panel is minimized or off-screen. This adds a global
// toast so copy/screenshot results are always visible.
(function () {
  let toastEl = null, toastTimer = null;

  function toastEnsure() {
    if (toastEl && toastEl.isConnected) return toastEl;
    toastEl = document.createElement("div");
    toastEl.className = `${NS}-toast`;
    toastEl.style.setProperty("position", "fixed", "important");
    toastEl.style.setProperty("left", "50%", "important");
    toastEl.style.setProperty("bottom", "72px", "important");
    toastEl.style.setProperty("transform", "translateX(-50%) translateY(8px)", "important");
    toastEl.style.setProperty("z-index", "2147483647", "important");
    toastEl.style.setProperty("padding", "8px 14px", "important");
    toastEl.style.setProperty("border-radius", "8px", "important");
    toastEl.style.setProperty("background", "rgba(17, 17, 17, 0.92)", "important");
    toastEl.style.setProperty("color", "#fff", "important");
    toastEl.style.setProperty("font", "500 12px/1.4 -apple-system, 'Segoe UI', sans-serif", "important");
    toastEl.style.setProperty("box-shadow", "0 4px 16px rgba(0,0,0,0.25)", "important");
    toastEl.style.setProperty("opacity", "0", "important");
    toastEl.style.setProperty("transition", "opacity 140ms, transform 140ms", "important");
    toastEl.style.setProperty("pointer-events", "none", "important");
    toastEl.style.setProperty("max-width", "70vw", "important");
    try { mountSelectorSurface(toastEl); } catch (_) { (document.documentElement || document.body).appendChild(toastEl); }
    return toastEl;
  }

  function vibeToast(msg, isError) {
    const el = toastEnsure();
    el.textContent = msg;
    el.style.setProperty("background", isError ? "rgba(220, 38, 38, 0.95)" : "rgba(17, 17, 17, 0.92)", "important");
    requestAnimationFrame(() => {
      el.style.setProperty("opacity", "1", "important");
      el.style.setProperty("transform", "translateX(-50%) translateY(0)", "important");
    });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.style.setProperty("opacity", "0", "important");
      el.style.setProperty("transform", "translateX(-50%) translateY(8px)", "important");
    }, 1800);
  }

  // Wrap the picker's own feedback functions so every existing call site
  // (copy, screenshot, save, markdown) toasts automatically. Function
  // declarations hoist across the whole IIFE, so this IIFE — even though it
  // textually PRECEDES the declarations — rebinds them safely at evaluation
  // time (call sites run much later, after init()). Assignment works because
  // function declarations inside the closure are mutable bindings.
  try {
    if (typeof showCopyFeedback === "function") {
      const _origCopy = showCopyFeedback;
      showCopyFeedback = function (msg, isError, detail) {
        try { vibeToast(msg, isError); } catch (_) {}
        return _origCopy(msg, isError, detail);
      };
    }
    if (typeof showScreenshotFeedback === "function") {
      const _origShot = showScreenshotFeedback;
      showScreenshotFeedback = function (msg, isError, detail) {
        try { vibeToast(msg, isError); } catch (_) {}
        return _origShot(msg, isError, detail);
      };
    }
  } catch (_) { /* fail soft */ }
})();
