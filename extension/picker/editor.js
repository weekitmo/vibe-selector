/**
 * Selector — visual element picker with per-element annotations.
 * Inject via bookmarklet. Click = select, Shift+click = multi, Drag = marquee.
 */
(function () {
  "use strict";
  // Already running: the Pro extension may re-inject after SPA navigations or a
  // second activation shortcut. Prefer a soft resume over a no-op.
  if (document.querySelector(".agent-editor-root")) {
    try {
      if (typeof window.__SELECTOR_ON_REACTIVATE__ === "function") {
        window.__SELECTOR_ON_REACTIVATE__();
      }
    } catch (_) {}
    return;
  }

  const NS = "agent-editor";
  // ── Host capability seam (HOST_CONTRACT.md §0/§1) ────────────
  // The closed-source extension injects window.__SELECTOR_HOST__ in the MAIN
  // world before this core runs, supplying stronger implementations (cross-tab
  // capture, cross-origin asset fetch, extra UI rows, ...).
  // For the free bookmarklet __SELECTOR_HOST__ is undefined → HOST = {} → every
  // seam below falls through to its existing else-branch and behaves exactly as
  // before. Each Host method is OPTIONAL: callers must always keep the original
  // logic as the fallback. Never make a path Host-only.
  const HOST = (typeof window !== "undefined" && window.__SELECTOR_HOST__) || {};
  const AI_ID = "data-ai-id";
  const VERSION = "0.4.1";
  // Cross-link targets for the settings-panel promo (bookmarklet ⇄ Pro extension).
  const EXT_LANDING_URL = "about:blank";
  const BOOKMARKLET_URL = "about:blank";
  // Keep the bookmarklet's pause behavior and visible shortcut hint sourced
  // from one value so they cannot drift apart again.
  const PAUSE_SHORTCUT_KEY = "F2";

  // ── i18n ─────────────────────────────────────────────────────
  const DICT = {
    en: {
      selecting:"Selecting", paused:"Paused", copyPrompt:"Copy Prompt", copyReport:"Copied!", copyCombined:"Copy + Screenshot", copyScreenshot:"Copy Screenshot",
      copied:"Copied", copiedFallback:"Copied via fallback", copyFailed:"Copy failed", copiedSaved:"Copied + Saved", exported:"Markdown Exported", screenshotCopied:"Screenshot Copied", screenshotCopiedSaved:"Screenshot Copied + Saved", screenshotFailed:"Screenshot Failed",
      settings:"Settings", lang:"Language", addInstruction:"Add instruction",
      instrPlaceholder:"Instruction for this element\u2026", clear:"Clear", done:"Done",
      clearAll:"Clear all", minimize:"Minimize", restore:"Restore", close:"Close",
      groupGeneral:"General", groupShortcuts:"Page shortcuts",
      skSelect:"Select", skMulti:"Multi", skNavigate:"Navigate", skPause:"Pause",
      skCopy:"Copy", skScreenshot:"Screenshot", skMarkdown:"Markdown", skActivate:"Toggle", skUndo:"Undo", skClear:"Clear",
      optCombined:"Screenshot + text combined", optCombinedDesc:"Copy screenshot and prompt text together",
      optCombinedPro:"Copy button includes screenshot", optCombinedProDesc:"The main copy action also captures the selected element",
      optSharingan:"Mirror mode", optSharinganDesc:"Copy a complete DOM, CSS, font and animation report",
      savePng:"Save PNG",
      proShortcutTitle:"Activation shortcut", proShortcutHint:"Opens Chrome shortcut settings",
      shortcutCopyContext:"Copy context", shortcutCopyContextDesc:"Copy the selected elements and page context",
      shortcutScreenshotContext:"Screenshot + context", shortcutScreenshotContextDesc:"Copy a PNG screenshot with the selected context",
      shortcutMarkdown:"Markdown", shortcutMarkdownDesc:"Copy the selected content as Markdown",
      shortcutRecordHint:"Press a shortcut. Single keys and combinations are supported; Delete clears.", shortcutDuplicate:"That shortcut is already assigned.", shortcutInvalid:"Typing keys need Command, Control, or Alt.", shortcutCleared:"Not set",
      shortcutUnassigned:"Not set", shortcutSet:"Set", shortcutChange:"Change",
      proPromoTitle:"Vibe Selector Plus", proPromoDesc:"Always one shortcut away. Stays active across tabs, captures complete elements without dialogs, and syncs your settings.", proPromoCta:"Get the extension →",
      freePromoTitle:"Free bookmarklet", freePromoDesc:"No install — drag a bookmark, use on any page.", freePromoCta:"Open on GitHub →",
      mdTitle:"Markdown ready", mdPreparing:"Preparing Markdown…", copyMarkdown:"Copy Markdown",
      errUnsupported:"Browser not supported", errCancelled:"Screen choice cancelled",
      errPermission:"Screen recording blocked", errClipboard:"Clipboard blocked",
      errCapture:"Screenshot failed", errEmpty:"Selected area is empty", errDownload:"File save failed",
    },
    zh: {
      selecting:"\u9009\u62e9\u4e2d", paused:"\u5df2\u6682\u505c", copyPrompt:"\u590d\u5236\u63d0\u793a\u8bcd", copyReport:"\u955c\u50cf\u5df2\u590d\u5236", copyCombined:"\u590d\u5236\u56fe\u6587", copyScreenshot:"\u590d\u5236\u622a\u56fe",
      copied:"\u5df2\u590d\u5236", copiedFallback:"\u5df2\u901a\u8fc7\u5907\u7528\u65b9\u5f0f\u590d\u5236", copyFailed:"\u590d\u5236\u5931\u8d25", copiedSaved:"\u5df2\u590d\u5236\u5e76\u4fdd\u5b58", exported:"Markdown \u5df2\u5bfc\u51fa", screenshotCopied:"\u622a\u56fe\u5df2\u590d\u5236", screenshotCopiedSaved:"\u622a\u56fe\u5df2\u590d\u5236\u5e76\u4fdd\u5b58", screenshotFailed:"\u622a\u56fe\u5931\u8d25",
      settings:"\u8bbe\u7f6e", lang:"\u8bed\u8a00", addInstruction:"\u6dfb\u52a0\u6307\u4ee4",
      instrPlaceholder:"\u6b64\u5143\u7d20\u7684\u4fee\u6539\u6307\u4ee4\u2026", clear:"\u6e05\u9664", done:"\u5b8c\u6210",
      clearAll:"\u6e05\u9664\u5168\u90e8", minimize:"\u6700\u5c0f\u5316", restore:"\u6062\u590d", close:"\u5173\u95ed",
      groupGeneral:"\u901a\u7528", groupShortcuts:"\u9875\u5185\u5feb\u6377\u952e",
      skSelect:"\u9009\u62e9", skMulti:"\u591a\u9009", skNavigate:"\u5bfc\u822a", skPause:"\u6682\u505c",
      skCopy:"\u590d\u5236", skScreenshot:"\u622a\u56fe", skMarkdown:"Markdown", skActivate:"\u5f00/\u5173", skUndo:"\u64a4\u9500", skClear:"\u6e05\u9664",
      optCombined:"\u622a\u56fe + \u6587\u672c\u5408\u5e76", optCombinedDesc:"\u540c\u65f6\u590d\u5236\u622a\u56fe\u548c\u63d0\u793a\u8bcd\u6587\u672c",
      optCombinedPro:"\u590d\u5236\u6309\u94ae\u540c\u65f6\u622a\u56fe", optCombinedProDesc:"\u70b9\u51fb\u4e3b\u590d\u5236\u6309\u94ae\u65f6\uff0c\u540c\u65f6\u622a\u53d6\u5df2\u9009\u5143\u7d20",
      optSharingan:"\u955c\u50cf\u6a21\u5f0f", optSharinganDesc:"\u590d\u5236\u5b8c\u6574 DOM\u3001\u6837\u5f0f\u3001\u5b57\u4f53\u4e0e\u52a8\u753b\u62a5\u544a",
      savePng:"\u4fdd\u5b58 PNG",
      proShortcutTitle:"\u542f\u52a8\u5feb\u6377\u952e", proShortcutHint:"\u6253\u5f00 Chrome \u5feb\u6377\u952e\u8bbe\u7f6e",
      shortcutCopyContext:"\u590d\u5236\u4e0a\u4e0b\u6587", shortcutCopyContextDesc:"\u590d\u5236\u5df2\u9009\u5143\u7d20\u548c\u9875\u9762\u4e0a\u4e0b\u6587",
      shortcutScreenshotContext:"\u622a\u56fe + \u4e0a\u4e0b\u6587", shortcutScreenshotContextDesc:"\u590d\u5236\u5e26\u5df2\u9009\u4e0a\u4e0b\u6587\u7684 PNG \u622a\u56fe",
      shortcutMarkdown:"Markdown", shortcutMarkdownDesc:"\u5c06\u5df2\u9009\u5185\u5bb9\u590d\u5236\u4e3a Markdown",
      shortcutRecordHint:"\u8bf7\u6309\u4e0b\u5feb\u6377\u952e\u3002\u652f\u6301\u5355\u952e\u548c\u7ec4\u5408\u952e\uff1bDelete \u6e05\u9664\u3002", shortcutDuplicate:"\u8be5\u5feb\u6377\u952e\u5df2\u5206\u914d\u3002", shortcutInvalid:"\u5b57\u6bcd\u3001\u6570\u5b57\u548c\u7b26\u53f7\u952e\u9700\u642d\u914d Command\u3001Control \u6216 Alt\u3002", shortcutCleared:"\u672a\u8bbe\u7f6e",
      shortcutUnassigned:"\u672a\u8bbe\u7f6e", shortcutSet:"\u8bbe\u7f6e", shortcutChange:"\u4fee\u6539",
      proPromoTitle:"Vibe Selector Plus", proPromoDesc:"\u968f\u65f6\u4e00\u952e\u5524\u8d77\u3002\u5207\u6362\u6807\u7b7e\u4ecd\u4fdd\u6301\u5f00\u542f\u3001\u96f6\u5f39\u7a97\u5b8c\u6574\u622a\u56fe\u3001\u8bbe\u7f6e\u81ea\u52a8\u540c\u6b65\u3002", proPromoCta:"\u83b7\u53d6\u6d4f\u89c8\u5668\u6269\u5c55 \u2192",
      freePromoTitle:"\u514d\u8d39\u4e66\u7b7e\u7248", freePromoDesc:"\u514d\u5b89\u88c5 \u2014\u2014 \u62d6\u4e00\u4e2a\u4e66\u7b7e\uff0c\u4efb\u610f\u9875\u9762\u53ef\u7528\u3002", freePromoCta:"\u5728 GitHub \u6253\u5f00 \u2192",
      mdTitle:"Markdown \u5df2\u751f\u6210", mdPreparing:"Markdown \u751f\u6210\u4e2d\u2026", copyMarkdown:"\u590d\u5236 Markdown",
      errUnsupported:"\u6d4f\u89c8\u5668\u4e0d\u652f\u6301", errCancelled:"\u5df2\u53d6\u6d88\u5c4f\u5e55\u9009\u62e9",
      errPermission:"\u5c4f\u5e55\u5f55\u5236\u6743\u9650\u53d7\u9650", errClipboard:"\u526a\u8d34\u677f\u6743\u9650\u53d7\u9650",
      errCapture:"\u622a\u56fe\u5931\u8d25", errEmpty:"\u9009\u4e2d\u533a\u57df\u65e0\u6cd5\u622a\u56fe", errDownload:"\u6587\u4ef6\u4fdd\u5b58\u5931\u8d25",
    }
  };
  let lang = "en";
  // Host may pre-seed the language (read once at init); else read localStorage;
  // else follow the browser's UI language so i18n consistently matches the user.
  try { lang = HOST.initialLang || localStorage.getItem(NS + "-lang") || (/^zh\b/i.test(navigator.language || "") ? "zh" : "en"); } catch(_) {}
  function t(k) { return (DICT[lang] && DICT[lang][k]) || DICT.en[k] || k; }

  // ── Settings ─────────────────────────────────────────────────
  const DEFAULTS = { combined:false, sharingan:false };
  // Pro-only page shortcuts. The free bookmarklet never reads these keys, so
  // its legacy Cmd/Ctrl bindings remain unchanged.
  const PRO_SHORTCUT_DEFAULTS = {
    shortcutCopyContext: "Mod+C",
    shortcutScreenshotContext: "Mod+Shift+C",
    shortcutMarkdown: "Mod+M",
  };
  const PRO_SHORTCUT_KEYS = Object.keys(PRO_SHORTCUT_DEFAULTS);
  // Reports up to this size go straight to the clipboard. Past this — and only
  // past it — we fall back to downloading the full report as a .md file so we
  // don't choke the OS clipboard. The previous floor (30_000) silently
  // downgraded every modern report to the short prompt-text fallback even
  // though browsers handle MB-class clipboard text fine.
  const SHARINGAN_CLIPBOARD_CHAR_LIMIT = 500000;
  let settings = Object.assign({}, DEFAULTS);
  // Host may pre-seed the settings object (read once at init); else read
  // localStorage. Either source is merged over DEFAULTS so the shape is stable.
  try { var s = HOST.initialSettings || JSON.parse(localStorage.getItem(NS + "-settings")); if (s) settings = Object.assign({}, DEFAULTS, s); } catch(_) {}
  if (HOST.pageShortcuts === true) settings = Object.assign({}, PRO_SHORTCUT_DEFAULTS, settings);
  const HOST_SETTINGS_BASE = HOST.isExtension === true
    ? Object.assign({}, HOST.pageShortcuts === true ? PRO_SHORTCUT_DEFAULTS : {}, HOST.initialSettings || {})
    : {};

  // Portable shortcut helpers are intentionally pure so both the recorder and
  // the MAIN-world keydown path use exactly the same representation.
  function normalizeShortcutKey(key) {
    const raw = String(key || "").trim();
    if (!raw) return "";
    const aliases = { " ": "Space", Spacebar: "Space", Esc: "Escape", Del: "Delete" };
    if (aliases[raw]) return aliases[raw];
    if (/^Key[A-Z]$/i.test(raw)) return raw.slice(-1).toUpperCase();
    if (/^Digit[0-9]$/.test(raw)) return raw.slice(-1);
    if (/^Numpad[0-9]$/.test(raw)) return raw.slice(-1);
    if (/^[a-z]$/i.test(raw)) return raw.toUpperCase();
    if (/^[0-9]$/.test(raw) || /^F(?:[1-9]|1[0-2])$/i.test(raw)) return raw.toUpperCase();
    if (/^(Space|Enter|Tab|Escape|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Arrow(?:Up|Down|Left|Right)|[.,/;'\\[\\]\\-=`])$/i.test(raw)) return raw.length === 1 ? raw : raw[0].toUpperCase() + raw.slice(1);
    return "";
  }
  function allowsSingleKeyShortcut(key) {
    return /^(?:Escape|F(?:[1-9]|1[0-2])|Space|Enter|Tab|Insert|Home|End|PageUp|PageDown|Arrow(?:Up|Down|Left|Right))$/.test(key);
  }
  function normalizeShortcutBinding(value) {
    if (!value) return "";
    const parts = String(value).split("+").map(part => part.trim()).filter(Boolean);
    let mod = false, alt = false, shift = false, key = "";
    for (const part of parts) {
      if (/^(?:Mod|Command|Cmd|Ctrl|Control)$/i.test(part)) mod = true;
      else if (/^(?:Alt|Option)$/i.test(part)) alt = true;
      else if (/^Shift$/i.test(part)) shift = true;
      else if (!key) key = normalizeShortcutKey(part);
      else return "";
    }
    if (!key || (!mod && !alt && !allowsSingleKeyShortcut(key))) return "";
    return (mod ? "Mod+" : "") + (alt ? "Alt+" : "") + (shift ? "Shift+" : "") + key;
  }
  function shortcutFromEvent(event) {
    if (!event || event.isComposing) return "";
    // `event.code` keeps letter/number shortcuts layout-independent, while
    // punctuation codes such as `BracketLeft` need the printable `event.key`.
    const key = normalizeShortcutKey(event.code) || normalizeShortcutKey(event.key);
    if (!key || (!event.metaKey && !event.ctrlKey && !event.altKey && !allowsSingleKeyShortcut(key))) return "";
    return normalizeShortcutBinding(
      (event.metaKey || event.ctrlKey ? "Mod+" : "") +
      (event.altKey ? "Alt+" : "") +
      (event.shiftKey ? "Shift+" : "") + key,
    );
  }
  function shortcutMatches(event, binding) {
    return !!binding && shortcutFromEvent(event) === normalizeShortcutBinding(binding);
  }
  function saveSettings() {
    // Host persists settings (fire-and-forget); bookmarklet uses localStorage.
    if (HOST.setSettings) { HOST.setSettings(settings); return; }
    try { localStorage.setItem(NS + "-settings", JSON.stringify(settings)); } catch(_) {}
  }

  // ── State ────────────────────────────────────────────────────
  let selectedElements = [], chatPanel = null, hoverBox = null, aiIdCounter = 0;
  let rafPending = false, layerRafPending = false, lastMoveTarget = null, minimized = false, paused = false;
  let layerHost = null;
  const selOverlays = new Map(), annotations = new Map(), listeners = [];
  let domObserver = null;
  let dragState = null, wasJustDragging = false, activePopover = null;
  const selectionHistory = [];
  let screenshotBtn = null, saveBtn = null, pendingScreenshotSave = null, settingsOpen = false, settingsPanel = null;
  let revPanel = null, pendingGenPrompt = null, pendingResultCopyKey = null, revStream = null;

  function on(target, type, fn, capture) {
    target.addEventListener(type, fn, capture);
    listeners.push({ target, type, fn, capture });
  }

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    assignAiIds(document.body);
    createHoverBox();
    createChatPanel();
    on(document, "mousedown", handleMouseDown, true);
    on(document, "click", handleClick, true);
    on(document, "mousemove", handleMouseMove, true);
    on(document, "mouseup", handleMouseUp, true);
    on(document, "mouseleave", () => { showHover(null); cancelDrag(); }, true);
    on(document, "keydown", handleKeyDown, true);
    let repositionRaf = false;
    const scheduleReposition = () => {
      if (!repositionRaf) { repositionRaf = true; requestAnimationFrame(() => { positionAllOverlays(); repositionRaf = false; }); }
    };
    on(window, "scroll", scheduleReposition, true);
    on(window, "resize", scheduleReposition, false);
    // SPA routes often replace large DOM subtrees without reloading this core.
    // Keep newly-added page elements addressable for click, marquee and undo.
    try {
      domObserver = new MutationObserver(records => {
        let addedPageContent = false;
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node && node.nodeType === 1 && !isEditorElement(node)) {
              assignAiIds(node);
              addedPageContent = true;
            }
          }
        }
        if (addedPageContent) scheduleSelectorLayerRefresh();
      });
      domObserver.observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) {}
    applyI18n();
    // Extension hooks: Pro can destroy/resume this instance after SPA nav or
    // a second activation shortcut without leaving orphan listeners behind.
    try {
      window.__SELECTOR_DESTROY__ = destroy;
      window.__SELECTOR_ON_REACTIVATE__ = function () {
        try {
          bringSelectorLayerToFront();
          if (minimized) toggleMinimize();
          if (paused) togglePaused();
        } catch (_) {}
      };
      // Same-document navigation (SPA/history) must look like a full reload:
      // keep the panel and synced preferences, discard page-specific UI state.
      window.__SELECTOR_ON_NAVIGATION__ = function () {
        try {
          showHover(null);
          cancelDrag();
          closeSettings();
          if (typeof closeRevPromptResult === "function") closeRevPromptResult();
          if (typeof clearPendingScreenshotSave === "function") clearPendingScreenshotSave();
          clearSelection();
          selectionHistory.length = 0;
          if (minimized) toggleMinimize();
          if (paused) togglePaused();
          assignAiIds(document.body);
          updateTags();
        } catch (_) {}
      };
      window.__SELECTOR_APPLY_SETTINGS__ = function (next) {
        if (!next || typeof next !== "object") return;
        settings = Object.assign({}, DEFAULTS, HOST_SETTINGS_BASE, next);
        if (settingsPanel) {
          settingsPanel.querySelectorAll(`.${NS}-setting-row[data-setting-key]`).forEach(row => {
            const key = row.dataset.settingKey;
            if (key === "lang") return;
            const input = row.querySelector('input[type="checkbox"]');
            if (input) input.checked = !!settings[key];
          });
          settingsPanel.querySelectorAll(`.${NS}-setting-row[data-setting-extra]`).forEach(row => {
            const key = row.dataset.settingExtra;
            const input = row.querySelector('input[type="checkbox"]');
            const select = row.querySelector("select");
            if (input) input.checked = !!settings[key];
            if (select && settings[key] != null) select.value = settings[key];
          });
          if (typeof refreshShortcutRows === "function") refreshShortcutRows();
        }
        applyI18n();
      };
      window.__SELECTOR_APPLY_LANG__ = function (next) {
        if (next !== "en" && next !== "zh") return;
        lang = next;
        applyI18n();
        refreshSettingsLabels();
      };
    } catch (_) {}
  }

  // ── Destroy ──────────────────────────────────────────────────
  function destroy() {
    for (const { target, type, fn, capture } of listeners) target.removeEventListener(type, fn, capture);
    listeners.length = 0;
    if (domObserver) { try { domObserver.disconnect(); } catch (_) {} domObserver = null; }
    destroyAllOverlays(); removeAnnotationPopover(); closeSettings();
    try { if (typeof closeRevPromptResult === "function") closeRevPromptResult(); } catch (_) {}
    if (hoverBox) hoverBox.remove();
    if (chatPanel) chatPanel.remove();
    if (layerHost) {
      try { if (layerHost.matches(":popover-open")) layerHost.hidePopover(); } catch (_) {}
      layerHost.remove();
    }
    hoverBox = null;
    chatPanel = null;
    layerHost = null;
    try {
      if (window.__SELECTOR_DESTROY__ === destroy) delete window.__SELECTOR_DESTROY__;
      delete window.__SELECTOR_ON_REACTIVATE__;
      delete window.__SELECTOR_ON_NAVIGATION__;
      delete window.__SELECTOR_APPLY_SETTINGS__;
      delete window.__SELECTOR_APPLY_LANG__;
    } catch (_) {}
    // Tell the Pro host to stop sticky re-open for this tab (X / shortcut off).
    if (HOST.onClosed) { try { HOST.onClosed(); } catch (_) {} }
  }

  // ── AI-ID ────────────────────────────────────────────────────
  function assignAiIds(root) {
    if (!root) return;
    if (root.nodeType === 1 && !isEditorElement(root) && !root.hasAttribute(AI_ID)) {
      root.setAttribute(AI_ID, `el-${aiIdCounter++}`);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node; while ((node = walker.nextNode())) { if (isEditorElement(node)) continue; if (!node.hasAttribute(AI_ID)) node.setAttribute(AI_ID, `el-${aiIdCounter++}`); }
  }
  function isEditorElement(el) { return el && el.closest && !!el.closest(`.${NS}-root, .${NS}-layer-host`); }
  function isTypingTarget(el) {
    return !!(el && (
      (el.closest && el.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')) ||
      el.isContentEditable
    ));
  }
  function ensureSelectorLayerHost() {
    if (layerHost && layerHost.isConnected) return layerHost;
    layerHost = document.createElement("div");
    layerHost.className = `${NS}-layer-host`;
    if (typeof layerHost.showPopover === "function") layerHost.setAttribute("popover", "manual");
    (document.documentElement || document.body).appendChild(layerHost);
    try { if (typeof layerHost.showPopover === "function") layerHost.showPopover(); } catch (_) {}
    return layerHost;
  }
  function bringSelectorLayerToFront() {
    const host = ensureSelectorLayerHost();
    if (typeof host.showPopover === "function") {
      try {
        if (host.matches(":popover-open")) host.hidePopover();
        host.showPopover();
        return;
      } catch (_) {}
    }
    const root = document.documentElement || document.body;
    if (host.parentNode === root) root.appendChild(host);
  }
  function mountSelectorSurface(surface) {
    ensureSelectorLayerHost().appendChild(surface);
    bringSelectorLayerToFront();
    return surface;
  }
  function scheduleSelectorLayerRefresh() {
    if (layerRafPending) return;
    layerRafPending = true;
    requestAnimationFrame(() => {
      layerRafPending = false;
      const host = ensureSelectorLayerHost();
      const surfaces = Array.from(document.querySelectorAll(`.${NS}-root`));
      const overlayClasses = [`${NS}-hover-box`, `${NS}-marquee`, `${NS}-sel-box`, `${NS}-sel-corner`, `${NS}-sel-label`, `${NS}-annotate-btn`];
      const panelClasses = [`${NS}-chat`, `${NS}-settings`, `${NS}-annotate-popover`, `${NS}-revprompt`];
      for (const surface of surfaces) {
        if (!overlayClasses.concat(panelClasses).some(name => surface.classList.contains(name))) {
          host.appendChild(surface);
        }
      }
      for (const name of overlayClasses.concat(panelClasses)) {
        document.querySelectorAll(`.${name}`).forEach(surface => {
          host.appendChild(surface);
        });
      }
    });
  }
  function byAiId(id) { return document.querySelector(`[${AI_ID}="${id}"]`); }

// ── Resolve target ───────────────────────────────────────────
  // Browsers do not dispatch pointer/click events to disabled form controls:
  // hovering or clicking a <button disabled> targets an ANCESTOR instead.
  // Hit-testing (elementsFromPoint) is unaffected and still reports the real
  // topmost element, so walk the stack and hand back the disabled control
  // the browser swallowed. Elements with pointer-events:none never appear in
  // the stack, so this cannot pick up non-interactive layers.
  function resolveEventTarget(e) {
    if (document.elementsFromPoint && e.clientX != null && e.clientY != null) {
      const stack = document.elementsFromPoint(e.clientX, e.clientY);
      for (const el of stack) {
        if (el === e.target) break; // reached the real target — nothing was retargeted
        if (el && el.nodeType === 1 && !isEditorElement(el) && el.disabled === true) return el;
      }
    }
    return e.target;
  }

  function resolveTarget(el) {
    const action = closestActionElement(el);
    if (action && !isEditorElement(action) && isVisible(action)) return action;
    let cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      if (isEditorElement(cur)) { cur = cur.parentElement; continue; }
      if (!isVisible(cur)) { cur = cur.parentElement; continue; }
      if (isMeaningful(cur)) return cur;
      cur = cur.parentElement;
    }
    return el;
  }

  function resolveNestedTargetFromSelection(e) {
    if (selectedElements.length !== 1) return null;
    const root = selectedElements[0];
    const r = root.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return null;
    const stack = document.elementsFromPoint ? document.elementsFromPoint(e.clientX, e.clientY) : [e.target];
    for (const el of stack) {
      const nested = resolveNestedTarget(root, el);
      if (nested) return nested;
    }
    return resolveNestedTarget(root, e.target);
  }

  function resolveNestedTarget(root, el) {
    const action = closestActionElement(el);
    if (action && action !== root && root.contains(action) && !isEditorElement(action) && isVisible(action)) return action;
    let cur = el;
    while (cur && cur !== root && cur !== document.body && cur !== document.documentElement) {
      if (!root.contains(cur)) return null;
      if (isEditorElement(cur)) { cur = cur.parentElement; continue; }
      if (isVisible(cur) && isMeaningful(cur)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function closestActionElement(el) {
    return el && el.closest && el.closest("button,a,input,select,textarea,[role='button'],[role='link'],[role='menuitem'],[role='tab'],[role='checkbox'],[role='radio']");
  }
  function isVisible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 && r.height < 2) return false;
    const s = getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0";
  }
  function isMeaningful(el) {
    if (isAtomicElement(el)) return true;
    if (hasDirectText(el)) return true;
    if (el.querySelector("img,video,canvas,svg,button,a,input,select,textarea,iframe")) return true;
    return el.children.length > 1;
  }

  function isAtomicElement(el) {
    const tag = el.tagName && el.tagName.toLowerCase();
    if (/^(button|a|input|select|textarea|img|video|canvas|svg|iframe|h[1-6]|p|li|dt|dd|summary)$/.test(tag)) return true;
    return !!el.getAttribute("role");
  }
  function hasDirectText(el) {
    for (const n of el.childNodes) { if (n.nodeType === 3 && n.textContent.trim()) return true; }
    return false;
  }

  // ── Hover overlay ────────────────────────────────────────────
  function createHoverBox() { hoverBox = document.createElement("div"); hoverBox.className = `${NS}-root ${NS}-hover-box${HOST.isExtension ? ` ${NS}-pro-hover` : ""}`; mountSelectorSurface(hoverBox); }
  function showHover(el) {
    if (!el || isEditorElement(el) || selectedElements.includes(el)) { hoverBox.style.opacity = "0"; return; }
    const r = el.getBoundingClientRect();
    hoverBox.style.top = (r.top-1)+"px"; hoverBox.style.left = (r.left-1)+"px";
    hoverBox.style.width = (r.width+2)+"px"; hoverBox.style.height = (r.height+2)+"px"; hoverBox.style.opacity = "1";
  }

  // ── Mouse handling ───────────────────────────────────────────
  function handleMouseMove(e) {
    if (minimized || paused) return;
    if (dragState) {
      const dx = e.clientX - dragState.startX, dy = e.clientY - dragState.startY;
      if (!dragState.isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        dragState.isDragging = true;
        dragState.marquee = document.createElement("div"); dragState.marquee.className = `${NS}-root ${NS}-marquee`;
        mountSelectorSurface(dragState.marquee); scheduleSelectorLayerRefresh(); showHover(null);
      }
      if (dragState.isDragging) {
        dragState.marquee.style.left = Math.min(e.clientX, dragState.startX)+"px";
        dragState.marquee.style.top = Math.min(e.clientY, dragState.startY)+"px";
        dragState.marquee.style.width = Math.abs(dx)+"px"; dragState.marquee.style.height = Math.abs(dy)+"px";
        return;
      }
    }
    lastMoveTarget = resolveNestedTargetFromSelection(e) || resolveTarget(resolveEventTarget(e));
    if (!rafPending) { rafPending = true; requestAnimationFrame(() => { showHover(lastMoveTarget); rafPending = false; }); }
  }
  function handleMouseDown(e) {
    if (isEditorElement(e.target) || minimized || paused || e.button !== 0) return;
    if (e.shiftKey) e.preventDefault();
    dragState = { startX: e.clientX, startY: e.clientY, isDragging: false, marquee: null };
  }
  function handleMouseUp(e) {
    if (!dragState || !dragState.isDragging) { dragState = null; return; }
    wasJustDragging = true;
    const mRect = dragState.marquee.getBoundingClientRect();
    dragState.marquee.remove(); dragState = null;
    pushHistory(); if (!e.shiftKey) clearSelection();
    document.querySelectorAll(`[${AI_ID}]`).forEach(el => {
      if (isEditorElement(el) || !isVisible(el) || !isMeaningful(el)) return;
      if (rectsIntersect(mRect, el.getBoundingClientRect())) addSelection(el);
    });
    updateTags(); setTimeout(() => { wasJustDragging = false; }, 0);
  }
  function cancelDrag() { if (dragState && dragState.marquee) dragState.marquee.remove(); dragState = null; }
  function rectsIntersect(a, b) { return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom); }
  function handleClick(e) {
    if (isEditorElement(e.target) || minimized || paused || wasJustDragging) return;
    e.preventDefault(); e.stopPropagation(); removeAnnotationPopover();
    const sel = window.getSelection(); if (sel) sel.removeAllRanges();
    pushHistory(); const el = resolveNestedTargetFromSelection(e) || resolveTarget(resolveEventTarget(e));
    if (e.shiftKey) toggleElement(el); else { clearUnannotatedSelections(); addSelection(el); }
    updateTags();
  }

  // ── Selection overlays ──────────────────────────────────────
  function createSelOverlay(el) {
    const aiId = el.getAttribute(AI_ID); if (selOverlays.has(aiId)) return;
    const box = document.createElement("div"); box.className = `${NS}-root ${NS}-sel-box${HOST.isExtension ? ` ${NS}-pro-selection` : ""}`;
    const corners = [0,1,2,3].map(i => { const c = document.createElement("div"); c.className = `${NS}-root ${NS}-sel-corner${HOST.isExtension ? ` ${NS}-pro-corner` : ""}`; c.style.animationDelay = `${i*28}ms`; mountSelectorSurface(c); return c; });
    const label = document.createElement("div"); label.className = `${NS}-root ${NS}-sel-label${HOST.isExtension ? ` ${NS}-pro-selection-label` : ""}`; label.textContent = elementLabel(el);
    const annotateBtn = document.createElement("button");
    annotateBtn.className = `${NS}-root ${NS}-annotate-btn${HOST.isExtension ? ` ${NS}-pro-annotate` : ""}`; annotateBtn.title = t("addInstruction");
    annotateBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    annotateBtn.onclick = (e) => { e.stopPropagation(); e.preventDefault(); showAnnotationPopover(el, annotateBtn); };
    const markdownBtn = document.createElement("button");
    markdownBtn.className = `${NS}-root ${NS}-annotate-btn ${NS}-markdown-btn${HOST.isExtension ? ` ${NS}-pro-annotate` : ""}`; markdownBtn.title = t("copyMarkdown");
    markdownBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>';
    markdownBtn.onclick = (e) => { e.stopPropagation(); e.preventDefault(); copyAsMarkdown([el]); };
    mountSelectorSurface(box); mountSelectorSurface(label); mountSelectorSurface(annotateBtn); mountSelectorSurface(markdownBtn);
    scheduleSelectorLayerRefresh();
    selOverlays.set(aiId, { box, corners, label, annotateBtn, markdownBtn }); positionSelOverlay(el);
  }
  function positionSelOverlay(el) {
    const aiId = el.getAttribute(AI_ID), ov = selOverlays.get(aiId); if (!ov) return;
    const r = el.getBoundingClientRect(), pad = 2;
    ov.box.style.top=(r.top-pad)+"px"; ov.box.style.left=(r.left-pad)+"px"; ov.box.style.width=(r.width+pad*2)+"px"; ov.box.style.height=(r.height+pad*2)+"px";
    const cs=6, pos=[{top:r.top-pad-cs/2,left:r.left-pad-cs/2},{top:r.top-pad-cs/2,left:r.right+pad-cs/2},{top:r.bottom+pad-cs/2,left:r.left-pad-cs/2},{top:r.bottom+pad-cs/2,left:r.right+pad-cs/2}];
    for (let i=0;i<4;i++) { ov.corners[i].style.top=pos[i].top+"px"; ov.corners[i].style.left=pos[i].left+"px"; }
    const toolbarTop = r.top-pad-20;
    ov.label.style.top=toolbarTop+"px"; ov.label.style.left=(r.left-pad)+"px";
    ov.markdownBtn.style.top=toolbarTop+"px"; ov.markdownBtn.style.left=(r.right+pad-20)+"px";
    ov.annotateBtn.style.top=toolbarTop+"px"; ov.annotateBtn.style.left=(r.right+pad-44)+"px";
    ov.annotateBtn.classList.toggle(`${NS}-has-note`, annotations.has(aiId));
  }
  function positionAllOverlays() { for (const el of selectedElements) positionSelOverlay(el); }
  function destroySelOverlay(aiId) { const ov=selOverlays.get(aiId); if(!ov)return; ov.box.remove(); ov.corners.forEach(c=>c.remove()); ov.label.remove(); ov.annotateBtn.remove(); ov.markdownBtn.remove(); selOverlays.delete(aiId); }
  function destroyAllOverlays() { for (const [aiId] of selOverlays) destroySelOverlay(aiId); }
  function addSelection(el) {
    if (!el || selectedElements.includes(el)) return;
    if (!el.hasAttribute(AI_ID)) el.setAttribute(AI_ID, `el-${aiIdCounter++}`);
    selectedElements.push(el); createSelOverlay(el);
  }
  function removeSelection(el) { const idx=selectedElements.indexOf(el); if(idx>=0){ selectedElements.splice(idx,1); destroySelOverlay(el.getAttribute(AI_ID)); annotations.delete(el.getAttribute(AI_ID)); } }
  function toggleElement(el) { selectedElements.includes(el) ? removeSelection(el) : addSelection(el); }
  function clearSelection() { destroyAllOverlays(); selectedElements=[]; annotations.clear(); removeAnnotationPopover(); }
  function clearUnannotatedSelections() { for (const el of selectedElements.slice()) { if (!annotations.has(el.getAttribute(AI_ID))) removeSelection(el); } removeAnnotationPopover(); }

  // ── History (undo) ──────────────────────────────────────────
  function pushHistory() { selectionHistory.push({ elements:[...selectedElements], annotations:new Map(annotations) }); if (selectionHistory.length>30) selectionHistory.shift(); }
  function undo() {
    if (!selectionHistory.length) return; const state=selectionHistory.pop();
    destroyAllOverlays(); removeAnnotationPopover(); selectedElements=state.elements;
    annotations.clear(); for (const [k,v] of state.annotations) annotations.set(k,v);
    for (const el of selectedElements) createSelOverlay(el); updateTags();
  }

  // ── Navigation ──────────────────────────────────────────────
  function navigateToParent() {
    if (selectedElements.length!==1) return;
    let p=selectedElements[0].parentElement;
    while(p&&p!==document.body&&p!==document.documentElement){ if(!isEditorElement(p)&&isVisible(p)){ pushHistory();clearSelection();addSelection(p);updateTags();return; } p=p.parentElement; }
  }
  function navigateToChild() {
    if (selectedElements.length!==1) return;
    for(const c of selectedElements[0].children){ if(!isEditorElement(c)&&isVisible(c)&&isMeaningful(c)){ pushHistory();clearSelection();addSelection(c);updateTags();return; } }
  }
  function navigateToSibling(dir) {
    if (selectedElements.length!==1) return; const el=selectedElements[0], par=el.parentElement; if(!par) return;
    const sibs=Array.from(par.children).filter(c=>!isEditorElement(c)&&isVisible(c)&&isMeaningful(c));
    const next=sibs[sibs.indexOf(el)+dir]; if(next){ pushHistory();clearSelection();addSelection(next);updateTags(); }
  }

  function handleKeyDown(e) {
    // Selector owns its shortcuts while selection is running, even when the
    // page focus sits in an input/editor. Only Selector's own form controls
    // keep native typing behavior.
    if (isEditorElement(e.target) && isTypingTarget(e.target)) return;
    // The document listener runs in capture phase. Let the settings recorder
    // consume its keystroke before any configured page action can fire.
    if (e.target && e.target.closest && e.target.closest(`.${NS}-shortcut-record`)) return;
    const mod=e.metaKey||e.ctrlKey;
    // Pro keeps the three page actions in MAIN world so they can be changed
    // without Chrome's global command registry. The free bookmarklet does not
    // opt into HOST.pageShortcuts and therefore keeps its historical keys.
    if (HOST.pageShortcuts === true) {
      if (shortcutMatches(e, settings.shortcutCopyContext) && (selectedElements.length > 0 || pendingGenPrompt)) { e.preventDefault(); copyPrompt(); return; }
      if (shortcutMatches(e, settings.shortcutScreenshotContext) && selectedElements.length > 0) { e.preventDefault(); captureScreenshot({ text: buildPromptText() }); return; }
      if (shortcutMatches(e, settings.shortcutMarkdown)) { e.preventDefault(); copyAsMarkdown(); return; }
    }
    if (HOST.pageShortcuts !== true && e.code === PAUSE_SHORTCUT_KEY && !mod && !e.altKey && !e.shiftKey && !e.repeat) {
      e.preventDefault();
      e.stopImmediatePropagation();
      togglePaused();
      return;
    }
    if(e.key==="Escape"){
      e.preventDefault();
      if(revPanel) closeRevPromptResult();
      else if(activePopover) removeAnnotationPopover();
      else if(settingsOpen) closeSettings();
      else if(selectedElements.length>0){ pushHistory(); clearSelection(); updateTags(); }
      return;
    }
    // ⌘C also works with NO selection while a result panel is open (⌘M with
    // no selection falls back to the page body, so there may be nothing
    // selected) — copyPrompt()'s pendingGenPrompt branch handles it.
    if(HOST.pageShortcuts !== true && mod&&e.key.toLowerCase()==="c"&&!e.shiftKey&&(selectedElements.length>0||pendingGenPrompt)){ e.preventDefault(); copyPrompt(); return; }
    if(HOST.pageShortcuts !== true && mod&&e.shiftKey&&e.key.toLowerCase()==="c"&&selectedElements.length>0){ e.preventDefault(); captureScreenshot(); return; }
    if(HOST.pageShortcuts !== true && mod&&!e.shiftKey&&e.key.toLowerCase()==="m"){ e.preventDefault(); copyAsMarkdown(); return; }
    if(mod&&e.key.toLowerCase()==="z"&&!e.shiftKey){ e.preventDefault(); undo(); return; }
    if(e.key==="ArrowUp"&&selectedElements.length===1){ e.preventDefault(); navigateToParent(); return; }
    if(e.key==="ArrowDown"&&selectedElements.length===1){ e.preventDefault(); navigateToChild(); return; }
    if(e.key==="ArrowLeft"&&selectedElements.length===1){ e.preventDefault(); navigateToSibling(-1); return; }
    if(e.key==="ArrowRight"&&selectedElements.length===1){ e.preventDefault(); navigateToSibling(1); return; }
  }

  function togglePaused() {
    paused = !paused; showHover(null);
    const dot = chatPanel.querySelector(`.${NS}-status-dot`), label = chatPanel.querySelector(`.${NS}-status-label`);
    if (dot) dot.style.background = paused ? "#888" : "#4ade80";
    if (label) label.textContent = paused ? t("paused") : t("selecting");
  }

// ── Annotation popover ──────────────────────────────────────
  function showAnnotationPopover(el, btn) {
    removeAnnotationPopover(); const aiId = el.getAttribute(AI_ID);
    const popover = document.createElement("div"); popover.className = `${NS}-root ${NS}-annotate-popover`;
    const textarea = document.createElement("textarea"); textarea.className = `${NS}-annotate-input`;
    textarea.value = annotations.get(aiId)||""; textarea.placeholder = t("instrPlaceholder"); textarea.rows = 2;
    const actions = document.createElement("div"); actions.className = `${NS}-annotate-actions`;
    const clearBtn = document.createElement("button"); clearBtn.className = `${NS}-annotate-clear`; clearBtn.textContent = t("clear");
    const doneBtn = document.createElement("button"); doneBtn.className = `${NS}-annotate-done`; doneBtn.textContent = t("done");
    const save = () => { const v=textarea.value.trim(); if(v) annotations.set(aiId,v); else annotations.delete(aiId); removeAnnotationPopover(); positionSelOverlay(el); };
    doneBtn.onclick = (e) => { e.stopPropagation(); save(); };
    clearBtn.onclick = (e) => { e.stopPropagation(); annotations.delete(aiId); removeAnnotationPopover(); positionSelOverlay(el); };
    textarea.addEventListener("keydown", (e) => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();save();} e.stopPropagation(); });
    textarea.addEventListener("click", (e) => e.stopPropagation());
    actions.appendChild(clearBtn); actions.appendChild(doneBtn); popover.appendChild(textarea); popover.appendChild(actions);
    const r = btn.getBoundingClientRect();
    popover.style.top = (r.bottom+6)+"px"; popover.style.right = Math.max(8, window.innerWidth-r.right)+"px";
    mountSelectorSurface(popover); activePopover = popover; textarea.focus();
  }
  function removeAnnotationPopover() { if (activePopover) { activePopover.remove(); activePopover = null; } }

  // ── Settings panel ──────────────────────────────────────────
  const GEAR_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  const CAMERA_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  const SHARINGAN_ICON_SRC = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAN1wAADdcBQiibeAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAAmdEVYdFRpdGxlAFNoYXJpbmdhbiAxLjUgc291cmNlIGZpbGUgLSA0OHB4GezWSAAAACl0RVh0QXV0aG9yAEhhcmVub21lIFJhbmFpdm9hcml2b255IFJhemFuYWphdG9bgQgTAAAAIHRFWHRDcmVhdGlvbiBUaW1lAE5vdmVtYmVyIDEydGggMjAxMGDwISsAAABjdEVYdENvcHlyaWdodABDQyBBdHRyaWJ1dGlvbi1Ob25Db21tZXJjaWFsLVNoYXJlQWxpa2UgaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbGljZW5zZXMvYnktbmMtc2EvMy4wL94EGuUAAAeMSURBVFiFxZdrjCRVFcd/p7qnXzPTO++e7V0GhocrCARkBVExKuoXNZt1jTEkG6LyCHFNiC5+MAjL+ophkTUhgK8Y5JsEcOMrEUM0ShZ0IQvyTAgLw27Po6fn0dVdXV117z1+6JqemR0eC9F4kkpV5Vbd8z//87/nniuqyv/T0qf6oYh45XL5cmAHsF1Vy0A5Ga6ISAU4AhyqVCqHVdWd0rxvx8Dk5GQuDMM9wN4PbR4r7TjnTC4uDTPcm2colwd11BpNqr7PUzM1fj91gsMz1VngQC6Xu+vYsWPhuwZQLpd3Agev2nb2xJ5LzqfcW4BmE4lDPGPAxqAKeCw6+Esj5LLREdTE3HHkGR56fXpKRG6sVCoPvyMAIiLj4+O3nl3su+Unn/iInNuXR30fr91CPA9BEUCAV1ttfjpd49GazxWDffxw6wiaSsPgIM/O1fj6E0d1qtXePzMzc5u+gbMNABLn9336tPLuH334UvpaPvgNJCV4IogIAlSN5Rczi/yutoxxSiHl8cDF2xhq1FFrUadocRN+Jsc3Dj/J3+YX75+Zmbn6ZBAbRDg2NnbrlZvHdh/84CXI3DTOGMQTwEMFEI/jUcy1r8ywGBtUFVXl8+VRhlpNcBZ1DnUON18ln8ly9/YLue7xp3b/3blXgH1vykCpVNp5VrH/wQc+eYXkF2pI3MZLeYh4ncg9qDvl+lfnOB6tOu8R4aELzmI4bHQitxa1DucczlrI5mj0D7DrH//SqVa4a3Z2tqsJb+VhcnIy53newds/cJHkalW0FaDWJZN1rthYbpqqMhVGncmT66JigeF2gFpN/nE4px0mrOKaTQp+nQMXbBMROTg5OZnbACAIgj07tmyeeE9KsHU/yaPrgnDO8pjf4tmgDdCNXlXJobgoxlmDsxbnHOo6LKh25rCLNc7LZvjs2PBEEAR71gEQEQ/Ye8M5Z2BrNdRZ3IrjxLkayyN+uC5y5xyqytP1gMhanFVcbHDtNrYVYNshGsW4RJRmvsrXTj8NYG/isyPCsbGxy7cPDZTG1WFbLTxPQMHh4TkBT0CEl8KIFc2oKnEcEwQBNWPY5y+xbyjfYU0ThpzikrsC6nmUejKcn8uUnh0buxx4LA1gjNlx5cgQxm+AtYljBXU4EUQ7y2+23cl9FEX4vk8Yrha5X7daVMOQ74300y+rANYBiQ22WuWj2R6ONoIdXQAisv3C/n5cw0esBVWcJwgd9XtOqKqyHAT4vk8URSevXgD+1Ah5vh1z72iRybS3Gv3aezviomwGEdm+VgPlgXQKF4U467o5V9NRvzMxR+fmWVhYII5jRISJfI7vn3M63z5zKyOZns4yFWHKOL40u8wTrajj1K0y4JziTMxQOkWyma0BALjYoMagJhGfNbg4xiwu8mSjtS7ab20tsSutXJ1Lc+3m0XVjdadcU2twJIxXxbpSnKxl2EtBspOmAay1yRq2OAFRTUpuZw2rMzze7kS+YvmgicUCUHCpdWMAFviO3+Y3xRxZdM2ypZuOLgOqWpmPQ1TBrdAex5ilJaI44qalkOfD9Xn/ca3OY62IR4KIny8sv6EmjhvLnc32ulSoeFSdAah0GVDVyokg3PaqcYwbw1g6xfFGg+diwx9jx1PGbYjwxdhyw7Ltvp88vmJ/iB3fzDokYYB0mvnYoqqrAETkyAt+8+Pj+QLXzM4T2pBW6y37iFO2liqvGceE0OkdejIcDSNE5AgkKTDGHPpzdZ4rh4a4vVwia+J35CQtwvbeApf2FUi9ARMvJvuCc4r0ZHm00cQYcwgSBnzfP/xvz5udWl4undvw+Vl5jB9UF3n6bVgo9/TwhaEin9vUz4AxABzD4865eQ43gu53JySFczFkMryuyvNRPOv7/uEuA6rqnHMH7qlMoyKMz81xz/AAd20Z5/353DqnAlzWW+COreM8dMYWrhLorVSIpqeJKhW2VOe4c3iAz2zq6/5TSnk455D+IvcuLOGcO7DStHb7ARHJFYvFl365eWzivWEL12ySyudIDw4RZDJYBBUlLUJvO8I16rhgNUp05aagYEZG+UptmdfimLuzac7rSfNiLs9Xp+em6vX6NlUN1wEAKBaLO7ek0w/+qlySwkINjSJEQLwUCHQ2MAX3Fh23JiDE4+XRUa6bmee3uR5SAwN8uTKrJ4zZVa/XNzYkAPV6/eGKtftvrtbQ4REkk+lsscbgTKc2uNgk1W1NmXWadD+uO+aM4aylZb44uIm+wUFurtaoWLt/rfMNDCSpkP7+/vsuzWV3f3d0lEJ9CddoJGMrKlh5XhN4dxrtPnt9fTRPO51bXn6Zf4bt+33f39CUvmlb3tfXd+uWnp5bbhsZlnM9cIuLuHZ79ZuNzHfNy2bxBgd5wcG+2oIej6L9jUbj1NrytVYoFHZ6nnfwU72FiesHBymjuFYLF7YgKdkAkkpBOoWXy+Pl81QQfrq4yCPNYMo5d2MQBO/sYHISG7ne3t49wN73ZTOlj+ULXJjPMZxKMZROAbBgLDVreaYV8tdWwHPtaBY40Gw271pR+7sGsAaIl8/nu4dTOttp93CaXEeAQ61W6793OP1f238AQw7/dVTED/cAAAAASUVORK5CYII=";
  const SHARINGAN_ICON = `<img class="${NS}-sharingan-icon" src="${SHARINGAN_ICON_SRC}" alt="" aria-hidden="true">`;
  // Small stroke icons for the other rows so each setting reads at a glance.
  const ICON_BOOKMARK = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;

  function settingTextKey(key, suffix = "") {
    if (key === "combined" && HOST.screenshotClipboardContext === true) return `optCombinedPro${suffix}`;
    return "opt" + key[0].toUpperCase() + key.slice(1) + suffix;
  }

  function mkToggle(key) {
    const row = document.createElement("div"); row.className = `${NS}-setting-row`;
    row.dataset.settingKey = key;
    const info = document.createElement("div"); info.className = `${NS}-setting-info`;
    const labelLine = document.createElement("span"); labelLine.className = `${NS}-setting-label-line`;
    const lbl = document.createElement("span"); lbl.className = `${NS}-setting-label`; lbl.textContent = t(settingTextKey(key));
    labelLine.appendChild(lbl);
    const desc = document.createElement("span"); desc.className = `${NS}-setting-desc`; desc.textContent = t(settingTextKey(key, "Desc"));
    info.appendChild(labelLine); info.appendChild(desc);
    const toggle = document.createElement("label"); toggle.className = `${NS}-toggle`;
    const input = document.createElement("input"); input.type = "checkbox"; input.checked = !!settings[key];
    const slider = document.createElement("span"); slider.className = `${NS}-toggle-slider`;
    toggle.appendChild(input); toggle.appendChild(slider);
    input.onchange = () => {
      settings[key] = input.checked; saveSettings();
      applyI18n();
      // Visual feedback: flash the row
      row.classList.remove(`${NS}-setting-flash`);
      void row.offsetWidth; // force reflow to restart animation
      row.classList.add(`${NS}-setting-flash`);
    };
    row.appendChild(info); row.appendChild(toggle); return row;
  }

  function formatPageShortcut(value) {
    const raw = normalizeShortcutBinding(value);
    if (!raw) return t("shortcutCleared");
    const isMac = /Mac|iPhone|iPad|iPod/i.test((navigator && navigator.platform) || "");
    const parts = raw.split("+");
    if (isMac) {
      const symbols = { Mod:"\u2318", Alt:"\u2325", Shift:"\u21e7" };
      return parts.map(part => symbols[part] || part).join("");
    }
    return parts.map(part => part === "Mod" ? "Ctrl" : part).join("+");
  }
  function isMacPlatform() {
    return /Mac|iPhone|iPad|iPod/i.test((navigator && navigator.platform) || "");
  }

  function shortcutActionLabel(key) {
    return key === "shortcutCopyContext" ? t("shortcutCopyContext")
      : key === "shortcutScreenshotContext" ? t("shortcutScreenshotContext")
      : t("shortcutMarkdown");
  }

  function refreshShortcutRows() {
    if (!settingsPanel || HOST.pageShortcuts !== true) return;
    settingsPanel.querySelectorAll(`.${NS}-shortcut-row[data-shortcut-key]`).forEach(row => {
      const key = row.dataset.shortcutKey;
      const button = row.querySelector(`.${NS}-shortcut-record`);
      const label = row.querySelector(`.${NS}-setting-label`);
      if (label) label.textContent = shortcutActionLabel(key);
      if (button && !button.dataset.recording) button.textContent = formatPageShortcut(settings[key]);
      const desc = row.querySelector(`.${NS}-setting-desc`);
      if (desc && !button.dataset.recording) desc.textContent = t(key + "Desc");
    });
  }

  function mkShortcutRow(key) {
    const row = document.createElement("div");
    row.className = `${NS}-setting-row ${NS}-shortcut-row`;
    row.dataset.shortcutKey = key;
    const info = document.createElement("div"); info.className = `${NS}-setting-info`;
    const label = document.createElement("span"); label.className = `${NS}-setting-label`; label.textContent = shortcutActionLabel(key);
    const desc = document.createElement("span"); desc.className = `${NS}-setting-desc`; desc.textContent = t(key + "Desc");
    info.appendChild(label); info.appendChild(desc);
    const button = document.createElement("button");
    button.type = "button"; button.className = `${NS}-shortcut-record ${NS}-settings-shortcut-action`;
    button.textContent = formatPageShortcut(settings[key]);
    button.title = t("shortcutRecordHint");
    button.addEventListener("keydown", event => {
      event.preventDefault(); event.stopPropagation();
      if (event.key === "Backspace" || event.key === "Delete") {
        settings[key] = ""; saveSettings();
        delete button.dataset.recording;
        button.textContent = formatPageShortcut("");
        desc.textContent = t(key + "Desc");
        updateShortcuts();
        return;
      }
      const next = shortcutFromEvent(event);
      if (!next) { desc.textContent = t("shortcutInvalid"); return; }
      const activationConflict = normalizeShortcutBinding(HOST.activationShortcut) === next;
      const duplicate = activationConflict || PRO_SHORTCUT_KEYS.some(other => other !== key && normalizeShortcutBinding(settings[other]) === next);
      if (duplicate) { desc.textContent = t("shortcutDuplicate"); return; }
      settings[key] = next; saveSettings();
      delete button.dataset.recording;
      button.textContent = formatPageShortcut(next);
      desc.textContent = t(key + "Desc");
      row.classList.remove(`${NS}-setting-flash`); void row.offsetWidth; row.classList.add(`${NS}-setting-flash`);
      updateShortcuts();
    });
    button.addEventListener("focus", () => {
      button.dataset.recording = "1";
      button.textContent = t("shortcutRecordHint");
      desc.textContent = t("shortcutRecordHint");
    });
    button.addEventListener("blur", () => {
      if (button.dataset.recording) {
        delete button.dataset.recording;
        button.textContent = formatPageShortcut(settings[key]);
        desc.textContent = t(key + "Desc");
      }
    });
    row.appendChild(info); row.appendChild(button); return row;
  }

  // ── Host UI extra rows (HOST_CONTRACT.md §1.6) ──────────────
  // These reuse the exact markup/classes of mkToggle so extension-supplied rows
  // are visually consistent with the built-in ones. Labels come from the extra
  // descriptor (labelEn/labelZh/descEn/descZh) rather than the DICT, and writes
  // go to settings[key] + saveSettings(). Only reached when HOST.uiExtras exists.
  function extraText(extra, base) {
    return lang === "zh" ? (extra[base + "Zh"] || extra[base + "En"] || "") : (extra[base + "En"] || extra[base + "Zh"] || "");
  }
  function mkExtraToggle(extra) {
    if (!extra || !extra.key) return null;
    const row = document.createElement("div"); row.className = `${NS}-setting-row`;
    row.dataset.settingExtra = extra.key;
    const info = document.createElement("div"); info.className = `${NS}-setting-info`;
    const labelLine = document.createElement("span"); labelLine.className = `${NS}-setting-label-line`;
    const lbl = document.createElement("span"); lbl.className = `${NS}-setting-label`; lbl.textContent = extraText(extra, "label");
    labelLine.appendChild(lbl);
    const descText = extraText(extra, "desc");
    info.appendChild(labelLine);
    if (descText) { const desc = document.createElement("span"); desc.className = `${NS}-setting-desc`; desc.textContent = descText; info.appendChild(desc); }
    const toggle = document.createElement("label"); toggle.className = `${NS}-toggle`;
    const input = document.createElement("input"); input.type = "checkbox"; input.checked = !!settings[extra.key];
    const slider = document.createElement("span"); slider.className = `${NS}-toggle-slider`;
    toggle.appendChild(input); toggle.appendChild(slider);
    input.onchange = () => {
      settings[extra.key] = input.checked; saveSettings();
      applyI18n();
      row.classList.remove(`${NS}-setting-flash`);
      void row.offsetWidth;
      row.classList.add(`${NS}-setting-flash`);
    };
    row.appendChild(info); row.appendChild(toggle); return row;
  }
  function mkExtraSelect(extra) {
    if (!extra || !extra.key) return null;
    const row = document.createElement("div"); row.className = `${NS}-setting-row`;
    row.dataset.settingExtra = extra.key;
    const info = document.createElement("div"); info.className = `${NS}-setting-info`;
    const labelLine = document.createElement("span"); labelLine.className = `${NS}-setting-label-line`;
    const lbl = document.createElement("span"); lbl.className = `${NS}-setting-label`; lbl.textContent = extraText(extra, "label");
    labelLine.appendChild(lbl);
    const descText = extraText(extra, "desc");
    info.appendChild(labelLine);
    if (descText) { const desc = document.createElement("span"); desc.className = `${NS}-setting-desc`; desc.textContent = descText; info.appendChild(desc); }
    const select = document.createElement("select"); select.className = `${NS}-setting-select`;
    (extra.options || []).forEach(opt => {
      const o = document.createElement("option"); o.value = opt.value;
      o.textContent = lang === "zh" ? (opt.labelZh || opt.labelEn || opt.value) : (opt.labelEn || opt.labelZh || opt.value);
      if (settings[extra.key] === opt.value) o.selected = true;
      select.appendChild(o);
    });
    select.onchange = (e) => {
      e.stopPropagation();
      settings[extra.key] = select.value; saveSettings();
      applyI18n();
      row.classList.remove(`${NS}-setting-flash`);
      void row.offsetWidth;
      row.classList.add(`${NS}-setting-flash`);
    };
    row.appendChild(info); row.appendChild(select); return row;
  }

  function mkSettingGroup(key) {
    const group = document.createElement("div");
    group.className = `${NS}-setting-group-title`;
    group.dataset.settingGroup = key;
    group.textContent = t("group" + key[0].toUpperCase() + key.slice(1));
    return group;
  }

  function formatActivationShortcut(value) {
    const raw = String(value || "");
    if (!raw) return "";
    const isMac = /Mac|iPhone|iPad|iPod/i.test((navigator && navigator.platform) || "");
    if (!isMac) return raw;
    const symbols = { Alt:"\u2325", Shift:"\u21e7", Command:"\u2318", Ctrl:"\u2303", MacCtrl:"\u2303" };
    return raw.split("+").map(part => symbols[part] || part).join("");
  }

  function refreshProSettingsSummary() {
    if (!settingsPanel) return;
    const block = settingsPanel.querySelector(`.${NS}-settings-pro`);
    if (!block) return;
    const title = block.querySelector(`.${NS}-settings-pro-title`);
    if (title) title.textContent = t("proShortcutTitle");
    const hint = block.querySelector(`.${NS}-settings-pro-hint`);
    if (hint) hint.textContent = t("proShortcutHint");
    const shortcut = block.querySelector(`.${NS}-settings-shortcut-current`);
    const edit = block.querySelector(`.${NS}-settings-shortcut-edit`);
    const assigned = !!HOST.activationShortcut;
    if (shortcut) {
      shortcut.textContent = assigned ? formatActivationShortcut(HOST.activationShortcut) : t("shortcutUnassigned");
      shortcut.classList.toggle(`${NS}-settings-shortcut-unassigned`, !assigned);
    }
    if (edit) edit.textContent = t(assigned ? "shortcutChange" : "shortcutSet");
  }

  function mkProSettingsSummary() {
    const wrap = document.createElement("div"); wrap.className = `${NS}-settings-pro`;
    const head = document.createElement("div"); head.className = `${NS}-settings-pro-head`;

    const meta = document.createElement("div"); meta.className = `${NS}-settings-pro-meta`;
    const labelLine = document.createElement("div"); labelLine.className = `${NS}-settings-pro-label-line`;
    const badge = document.createElement("span"); badge.className = `${NS}-pro-badge`; badge.textContent = "Plus";
    const title = document.createElement("span"); title.className = `${NS}-settings-pro-title`;
    labelLine.appendChild(badge); labelLine.appendChild(title);
    const hint = document.createElement("span"); hint.className = `${NS}-settings-pro-hint`;
    meta.appendChild(labelLine); meta.appendChild(hint);

    const shortcutBtn = document.createElement("button"); shortcutBtn.type = "button"; shortcutBtn.className = `${NS}-settings-shortcut-action`;
    const shortcut = document.createElement("kbd"); shortcut.className = `${NS}-settings-shortcut-current`;
    const edit = document.createElement("span"); edit.className = `${NS}-settings-shortcut-edit`;
    shortcutBtn.appendChild(shortcut); shortcutBtn.appendChild(edit);
    shortcutBtn.onclick = (e) => {
      e.stopPropagation();
      if (HOST.openShortcutSettings) HOST.openShortcutSettings();
      else if (HOST.openOptions) HOST.openOptions();
    };

    head.appendChild(meta); head.appendChild(shortcutBtn); wrap.appendChild(head);
    return wrap;
  }

  function createSettingsPanel() {
    settingsPanel = document.createElement("div"); settingsPanel.className = `${NS}-root ${NS}-settings${HOST.isExtension ? ` ${NS}-pro` : ""}`;
    const hdr = document.createElement("div"); hdr.className = `${NS}-settings-header`;
    const title = document.createElement("span"); title.className = `${NS}-settings-title`; title.textContent = t("settings");
    const langWrap = document.createElement("div"); langWrap.className = `${NS}-setting-row`; langWrap.dataset.settingKey = "lang";
    const langInfo = document.createElement("div"); langInfo.className = `${NS}-setting-info`;
    const langLbl = document.createElement("span"); langLbl.className = `${NS}-setting-label`; langLbl.textContent = t("lang");
    langInfo.appendChild(langLbl); langWrap.appendChild(langInfo);
    const langBtn = document.createElement("button"); langBtn.className = `${NS}-lang-btn`;
    langBtn.textContent = lang === "zh" ? "\u4e2d\u6587 / EN" : "EN / \u4e2d\u6587";
    langBtn.onclick = (e) => {
      e.stopPropagation(); lang = lang === "zh" ? "en" : "zh";
      // Host persists language; bookmarklet uses localStorage.
      if (HOST.setLang) HOST.setLang(lang);
      else { try { localStorage.setItem(NS + "-lang", lang); } catch(_) {} }
      langBtn.textContent = lang === "zh" ? "\u4e2d\u6587 / EN" : "EN / \u4e2d\u6587";
      applyI18n(); refreshSettingsLabels();
    };
    langWrap.appendChild(langBtn);
    const closeBtn = document.createElement("button"); closeBtn.className = `${NS}-settings-close`;
    closeBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    closeBtn.title = t("close"); closeBtn.onclick = closeSettings;
    hdr.appendChild(title); hdr.appendChild(closeBtn); settingsPanel.appendChild(hdr);
    settingsPanel.appendChild(langWrap);
    settingsPanel.appendChild(mkToggle("combined"));
    settingsPanel.appendChild(mkToggle("sharingan"));
    if (HOST.pageShortcuts === true) {
      settingsPanel.appendChild(mkSettingGroup("shortcuts"));
      PRO_SHORTCUT_KEYS.forEach(key => settingsPanel.appendChild(mkShortcutRow(key)));
    }
    // ── Host UI extras (HOST_CONTRACT.md §1.6) ────────────────
    // Bookmarklet has no HOST.uiExtras → loop is empty → panel is pixel-identical.
    // Extension appends extra toggle/select rows here, reusing existing styles.
    (HOST.uiExtras || []).forEach(extra => {
      const row = extra && extra.type === "select" ? mkExtraSelect(extra) : mkExtraToggle(extra);
      if (row) settingsPanel.appendChild(row);
    });
    // Keep the in-page panel focused on daily use. Lifetime-license management
    // stays in the options page; Pro shows only the real activation shortcut.
    settingsPanel.appendChild(HOST.isExtension ? mkProSettingsSummary() : mkSettingsPromo());
    mountSelectorSurface(settingsPanel);
    refreshProSettingsSummary();
    const cr = chatPanel.getBoundingClientRect();
    settingsPanel.style.bottom = (window.innerHeight - cr.top + 4) + "px";
    settingsPanel.style.right = Math.max(8, window.innerWidth - cr.right) + "px";
  }

  function refreshSettingsLabels() {
    if (!settingsPanel) return;
    settingsPanel.querySelectorAll(`.${NS}-setting-group-title`).forEach(group => {
      const k = group.dataset.settingGroup;
      group.textContent = t("group" + k[0].toUpperCase() + k.slice(1));
    });
    settingsPanel.querySelectorAll(`.${NS}-setting-row[data-setting-key]`).forEach(row => {
      const k = row.dataset.settingKey;
      if (k === "lang") return;
      const lbl = row.querySelector(`.${NS}-setting-label`); if (lbl) lbl.textContent = t(settingTextKey(k));
      const desc = row.querySelector(`.${NS}-setting-desc`); if (desc) desc.textContent = t(settingTextKey(k, "Desc"));
    });
    const stTitle = settingsPanel.querySelector(`.${NS}-settings-title`); if (stTitle) stTitle.textContent = t("settings");
    const langRow = settingsPanel.querySelector(`.${NS}-setting-row[data-setting-key="lang"]`);
    if (langRow) { const ll = langRow.querySelector(`.${NS}-setting-label`); if (ll) ll.textContent = t("lang"); }
    const promo = settingsPanel.querySelector(`.${NS}-settings-promo`);
    if (promo) {
      const isExt = !!HOST.isExtension;
      const tt = promo.querySelector(`.${NS}-settings-promo-title`); if (tt) tt.textContent = t(isExt ? "freePromoTitle" : "proPromoTitle");
      const dd = promo.querySelector(`.${NS}-settings-promo-desc`); if (dd) dd.textContent = t(isExt ? "freePromoDesc" : "proPromoDesc");
      const cc = promo.querySelector(`.${NS}-settings-promo-cta`); if (cc) cc.textContent = t(isExt ? "freePromoCta" : "proPromoCta");
    }
    refreshProSettingsSummary();
    refreshShortcutRows();
  }

  // Subtle cross-link shown at the bottom of the settings panel.
  // Bookmarklet (HOST absent / not extension) → upsell the Pro extension.
  // Extension (HOST.isExtension) → point to the free bookmarklet on GitHub.
  function mkSettingsPromo() {
    const isExt = !!HOST.isExtension;
    const wrap = document.createElement("a");
    wrap.className = `${NS}-settings-promo`;
    wrap.href = isExt ? BOOKMARKLET_URL : EXT_LANDING_URL;
    wrap.target = "_blank"; wrap.rel = "noopener noreferrer";
    wrap.onclick = (e) => e.stopPropagation();
    const title = document.createElement("span"); title.className = `${NS}-settings-promo-title`;
    title.textContent = t(isExt ? "freePromoTitle" : "proPromoTitle");
    const desc = document.createElement("span"); desc.className = `${NS}-settings-promo-desc`;
    desc.textContent = t(isExt ? "freePromoDesc" : "proPromoDesc");
    const cta = document.createElement("span"); cta.className = `${NS}-settings-promo-cta`;
    cta.textContent = t(isExt ? "freePromoCta" : "proPromoCta");
    wrap.appendChild(title); wrap.appendChild(desc); wrap.appendChild(cta);
    return wrap;
  }

  function toggleSettings() {
    settingsOpen ? closeSettings() : openSettings();
  }
  function openSettings() {
    if (settingsOpen) return; settingsOpen = true; createSettingsPanel();
  }
  function closeSettings() {
    settingsOpen = false; if (settingsPanel) { settingsPanel.remove(); settingsPanel = null; }
  }

  // ── i18n application ────────────────────────────────────────
  function applyI18n() {
    if (!chatPanel) return;
    const sl = chatPanel.querySelector(`.${NS}-status-label`);
    if (sl) sl.textContent = paused ? t("paused") : t("selecting");
    const cb = chatPanel.querySelector(`.${NS}-copy-btn`);
    if (cb && !cb.classList.contains(`${NS}-copy-done`)) setCopyButtonIdle(cb);
    if (screenshotBtn && !screenshotBtn.classList.contains(`${NS}-screenshot-done`) && !screenshotBtn.classList.contains(`${NS}-screenshot-error`))
      setScreenshotButtonIdle();
    if (saveBtn) saveBtn.textContent = t("savePng");
    const minBtn = chatPanel.querySelector('[data-action="minimize"]');
    if (minBtn) minBtn.title = minimized ? t("restore") : t("minimize");
    const closeBtn = chatPanel.querySelector('[data-action="close"]');
    if (closeBtn) closeBtn.title = t("close");
    const settingsBtnEl = chatPanel.querySelector('[data-action="settings"]');
    if (settingsBtnEl) settingsBtnEl.title = t("settings");
    updateShortcuts();
  }

  function copyButtonLabel() {
    if (settings.sharingan) return t("copyReport");
    if (settings.combined) return t("copyCombined");
    return t("copyPrompt");
  }

  function setCopyButtonIdle(btn) {
    // While a result panel is open, the Copy button copies that panel's text
    // instead of the current element prompt.
    const label = pendingGenPrompt ? t(pendingResultCopyKey || "copyMarkdown") : copyButtonLabel();
    if (pendingGenPrompt) btn.textContent = label;
    else btn.innerHTML = settings.sharingan ? `${SHARINGAN_ICON}<span>${label}</span>` : label;
    btn.title = label;
    btn.setAttribute("aria-label", label);
  }

  function updateShortcuts() {
    const sc = chatPanel.querySelector(`.${NS}-shortcuts`); if (!sc) return;
    const copyShortcut = HOST.pageShortcuts === true ? formatPageShortcut(settings.shortcutCopyContext) : (isMacPlatform() ? "\u2318C" : "Ctrl+C");
    const screenshotShortcut = HOST.pageShortcuts === true ? formatPageShortcut(settings.shortcutScreenshotContext) : (isMacPlatform() ? "\u2318\u21e7C" : "Ctrl+Shift+C");
    const markdownShortcut = HOST.pageShortcuts === true ? formatPageShortcut(settings.shortcutMarkdown) : (isMacPlatform() ? "\u2318M" : "Ctrl+M");
    const items = [
      `<span><kbd>Click</kbd> ${t("skSelect")}</span>`,
      `<span><kbd>Shift</kbd> ${t("skMulti")}</span>`,
      `<span><kbd>\u2190\u2191\u2192\u2193</kbd> ${t("skNavigate")}</span>`,
      `<span><kbd>${copyShortcut}</kbd> ${t("skCopy")}</span>`,
      `<span><kbd>${screenshotShortcut}</kbd> ${t("skScreenshot")}</span>`,
    ];
    // \u2318M copies rendered content as Markdown in both bookmarklet and Pro.
    items.push(`<span><kbd>${markdownShortcut}</kbd> ${t("skMarkdown")}</span>`);
    items.push(`<span><kbd>${isMacPlatform() ? "\u2318Z" : "Ctrl+Z"}</kbd> ${t("skUndo")}</span>`);
    if (HOST.pageShortcuts !== true) items.push(`<span><kbd>${PAUSE_SHORTCUT_KEY}</kbd> ${t("skPause")}</span>`);
    if (selectedElements.length) items.push(`<span><kbd>Esc</kbd> ${t("skClear")}</span>`);
    // Display Chrome's current assignment, including user customization.
    if (HOST.isExtension && HOST.activationShortcut) {
      const shortcut = formatActivationShortcut(HOST.activationShortcut).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);
      items.push(`<span><kbd>${shortcut}</kbd> ${t("skActivate")}</span>`);
    }
    sc.innerHTML = items.join("");
  }

  // ── Chat panel ──────────────────────────────────────────────
  function createChatPanel() {
    chatPanel = document.createElement("div"); chatPanel.className = `${NS}-root ${NS}-chat${HOST.isExtension ? ` ${NS}-pro` : ""}`;
    chatPanel.innerHTML = `
      <div class="${NS}-drag-handle">
        <span class="${NS}-drag-title">
          <span class="${NS}-status-dot"></span>
          <span class="${NS}-status-label">Selecting</span>
          ${HOST.isExtension ? `<span class="${NS}-pro-badge">Plus</span>` : `<span class="${NS}-version">v${VERSION}</span>`}
        </span>
        <div class="${NS}-panel-actions">
          <button class="${NS}-panel-btn" data-action="settings" title="Settings">${GEAR_SVG}</button>
          <button class="${NS}-panel-btn" data-action="minimize" title="Minimize">
            <svg width="10" height="2" viewBox="0 0 10 2" fill="none"><line x1="0" y1="1" x2="10" y2="1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
          <button class="${NS}-panel-btn" data-action="close" title="Close">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
      <div class="${NS}-panel-body">
        <div class="${NS}-chat-tags ${NS}-hidden"></div>
        <div class="${NS}-shortcuts"></div>
        <div class="${NS}-action-row">
          <button class="${NS}-copy-btn" disabled>Copy Prompt</button>
          <button class="${NS}-screenshot-btn" disabled title="Copy Screenshot" aria-label="Copy Screenshot">${CAMERA_SVG}</button>
          <button class="${NS}-save-btn ${NS}-hidden" type="button">Save PNG</button>
        </div>
      </div>`;
    mountSelectorSurface(chatPanel);
    chatPanel.querySelector(`.${NS}-copy-btn`).onclick = () => copyPrompt();
    screenshotBtn = chatPanel.querySelector(`.${NS}-screenshot-btn`);
    screenshotBtn.onclick = () => captureScreenshot();
    saveBtn = chatPanel.querySelector(`.${NS}-save-btn`);
    saveBtn.onclick = () => savePendingScreenshot();
    chatPanel.querySelector('[data-action="settings"]').onclick = toggleSettings;
    chatPanel.querySelector('[data-action="minimize"]').onclick = toggleMinimize;
    chatPanel.querySelector('[data-action="close"]').onclick = destroy;
    makeDraggable(chatPanel, chatPanel.querySelector(`.${NS}-drag-handle`));
  }

  const ICON_MINIMIZE = `<svg width="10" height="2" viewBox="0 0 10 2" fill="none"><line x1="0" y1="1" x2="10" y2="1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  const ICON_EXPAND = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 7L5 3L9 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  function toggleMinimize() {
    minimized = !minimized;
    const body = chatPanel.querySelector(`.${NS}-panel-body`), btn = chatPanel.querySelector('[data-action="minimize"]');
    if (minimized) { body.style.display="none"; chatPanel.classList.add(`${NS}-minimized`); showHover(null); btn.innerHTML=ICON_EXPAND; btn.title=t("restore"); closeSettings(); }
    else { body.style.display=""; chatPanel.classList.remove(`${NS}-minimized`); btn.innerHTML=ICON_MINIMIZE; btn.title=t("minimize"); }
  }

  function makeDraggable(panel, handle) {
    let sx,sy,sl,st;
    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest(`.${NS}-panel-btn`)) return; e.preventDefault();
      const r=panel.getBoundingClientRect(); sx=e.clientX; sy=e.clientY; sl=r.left; st=r.top;
      const move=(e)=>{ panel.style.left=sl+e.clientX-sx+"px"; panel.style.top=st+e.clientY-sy+"px"; panel.style.right="auto"; panel.style.bottom="auto"; };
      const up=()=>{ document.removeEventListener("mousemove",move); document.removeEventListener("mouseup",up); };
      document.addEventListener("mousemove",move); document.addEventListener("mouseup",up);
    });
  }

  // ── Element label ───────────────────────────────────────────
  function elementLabel(el) {
    const role = explicitOrImplicitRole(el);
    const label = accessibleLabel(el);
    if (role && label) return `${role} "${label}"`;
    if (label) return `${el.tagName.toLowerCase()} "${label}"`;
    if (el.id) return `#${el.id}`;
    if (el.classList.length) return `.${el.classList[0]}`;
    return `<${el.tagName.toLowerCase()}>`;
  }

  // ── Tags ────────────────────────────────────────────────────
  function updateTags() {
    const container=chatPanel.querySelector(`.${NS}-chat-tags`), copyBtn=chatPanel.querySelector(`.${NS}-copy-btn`);
    container.innerHTML = "";
    if (selectedElements.length > 0) {
      container.classList.remove(`${NS}-hidden`); copyBtn.disabled=false;
      if (screenshotBtn) screenshotBtn.disabled=false;
      for (let i=0;i<selectedElements.length;i++) {
        const el=selectedElements[i], aiId=el.getAttribute(AI_ID), tag=document.createElement("span");
        tag.className=`${NS}-tag`; const hasNote=annotations.has(aiId);
        tag.innerHTML=`<span class="${NS}-tag-num">${i+1}</span><span class="${NS}-tag-label">${elementLabel(el)}${hasNote?' \u270e':''}</span><button class="${NS}-tag-x" data-aiid="${aiId}" title="Remove">\u00d7</button>`;
        const thumb=thumbSrcForElement(el);
        if(thumb){ const ti=document.createElement("img"); ti.className=`${NS}-tag-thumb`; ti.src=thumb; ti.alt=""; tag.insertBefore(ti, tag.firstChild); }
        container.appendChild(tag);
      }
      container.querySelectorAll(`.${NS}-tag-x`).forEach(btn => {
        btn.addEventListener("click", (e) => { e.stopPropagation(); const el=byAiId(btn.dataset.aiid); if(el) removeSelection(el); updateTags(); }, true);
      });
      const clearBtn=document.createElement("button"); clearBtn.className=`${NS}-tags-action`; clearBtn.title=t("clearAll");
      clearBtn.innerHTML=`<svg width="8" height="8" viewBox="0 0 8 8" fill="none"><line x1="1" y1="1" x2="7" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="7" y1="1" x2="1" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> ${t("clearAll")}`;
      clearBtn.onclick = (e) => { e.stopPropagation(); clearSelection(); updateTags(); };
      container.appendChild(clearBtn);
    } else {
      container.classList.add(`${NS}-hidden`); copyBtn.disabled=true;
      if (screenshotBtn) screenshotBtn.disabled=true;
    }
    updateShortcuts();
  }

// ── Copy feedback ───────────────────────────────────────────
  let copyTimer=null;
  let copyRequestToken = 0;
  function showCopyFeedback(msg, isError, detail) {
    const btn=chatPanel.querySelector(`.${NS}-copy-btn`);
    if (!btn) return;
    if (copyTimer) clearTimeout(copyTimer);
    btn.classList.remove(`${NS}-copy-error`);
    btn.classList.add(`${NS}-copy-done`);
    if (isError) btn.classList.add(`${NS}-copy-error`);
    btn.style.setProperty("color", "#fff", "important");
    btn.style.setProperty("-webkit-text-fill-color", "#fff", "important");
    btn.style.setProperty("opacity", "1", "important");
    btn.title = detail || msg;
    btn.setAttribute("aria-label", detail || msg);
    btn.innerHTML = settings.sharingan
      ? `${SHARINGAN_ICON}<span>${msg}</span>`
      : `${isError ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>' : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'} <span style="color:#fff!important;-webkit-text-fill-color:#fff!important">${msg}</span>`;
    copyTimer = setTimeout(() => {
      btn.classList.remove(`${NS}-copy-done`, `${NS}-copy-error`);
      btn.title = "";
      btn.removeAttribute("aria-label");
      btn.style.removeProperty("color");
      btn.style.removeProperty("-webkit-text-fill-color");
      btn.style.removeProperty("opacity");
      setCopyButtonIdle(btn);
      copyTimer = null;
    }, 2000);
  }
  function showCopyCaptureError(code, err) {
    const key = screenshotErrorKey(code);
    const detail = err ? `${err.name || "Error"}: ${err.message || String(err)}` : "";
    if (err) console.warn(`[Selector] ${t(key)}`, err);
    showCopyFeedback(t(key), true, detail);
  }
  function showClipboardFeedback(result, token, successKey) {
    if (token !== copyRequestToken) return;
    if (result === "clipboard") showCopyFeedback(t(successKey || "copied"));
    else if (result === "fallback") showCopyFeedback(t("copiedFallback"));
    else showCopyFeedback(t("copyFailed"), true);
  }
  function showDownloadError(err) {
    const detail = err ? `${err.name || "Error"}: ${err.message || String(err)}` : "";
    if (err) console.warn(`[Selector] ${t("errDownload")}`, err);
    showCopyFeedback(t("errDownload"), true, detail);
  }
  async function copyPrompt() {
    const requestToken = ++copyRequestToken;
    // While a result panel is open, Copy copies that panel's text until closed.
    if (pendingGenPrompt) {
      const result = await writeToClipboard(pendingGenPrompt);
      showClipboardFeedback(result, requestToken);
      return;
    }
    // ── Alternate copy formats (HOST_CONTRACT.md §1.5) ────────
    // Bookmarklet settings never carry copyFormat → fmt is undefined → skipped.
    // The extension can provide an alternate local serializer.
    const fmt = settings.copyFormat;
    if (fmt && fmt !== "prompt" && HOST.buildCopyPayload) {
      try {
        const payload = await HOST.buildCopyPayload(fmt, {
          elements: selectedElements,
          lang,
          buildPromptText,
          buildSharinganReport,
        });
        if (payload) {
          const result = await writeToClipboard(payload.text);
          if (payload.download && payload.download.content) {
            downloadMarkdown(payload.download.content, payload.download.filename);
          }
          showClipboardFeedback(result, requestToken);
          return;
        }
      } catch (_) { /* fall through to existing logic */ }
    }
    // ── Pre-warm cross-origin assets (HOST_CONTRACT.md §1.4) ──
    // The Sharingan pipeline is synchronous; the extension fetches cross-origin
    // images (which the same-origin canvas path can't read) into a sync cache
    // here, BEFORE buildSharinganReport() runs. Bookmarklet has no HOST.prepareAssets
    // → skipped. Respects the live inlineCrossOrigin toggle when the extension
    // surfaces it; absent on the bookmarklet so the guard is a no-op there.
    if (settings.sharingan && settings.inlineCrossOrigin !== false && HOST.prepareAssets) {
      try { await HOST.prepareAssets(selectedElements); } catch (_) {}
    }
    // ── Pre-warm cross-origin CSS + @font-face (HOST_CONTRACT.md §11) ──
    // Same async-prepare / sync-read pattern as prepareAssets: fetch cross-origin
    // stylesheet text + font binaries into a sync cache before the synchronous
    // Sharingan pipeline runs. Bookmarklet has no HOST.prepareStyles → skipped.
    if (settings.sharingan && HOST.prepareStyles) {
      try { await HOST.prepareStyles(selectedElements); } catch (_) {}
    }
    const text = settings.sharingan ? buildSharinganReport() : buildPromptText(); if (!text) return;
    if (settings.combined) {
      if (settings.sharingan && text.length > SHARINGAN_CLIPBOARD_CHAR_LIMIT) {
        const filename = sharinganFilename();
        let realPath;
        try {
          realPath = await saveMarkdownFile(text, filename);
        } catch (err) {
          showDownloadError(err);
          return;
        }
        const promptText = appendSharinganDownloadReference(buildPromptText(), filename, text.length, realPath);
        if (requestToken === copyRequestToken) await captureScreenshot({ text: promptText, feedbackTarget: "copy", copyRequestToken: requestToken, downloadImage: false });
        return;
      }
      if (requestToken === copyRequestToken) await captureScreenshot({ text, feedbackTarget: "copy", copyRequestToken: requestToken, downloadImage: false });
      return;
    }
    if (settings.sharingan && text.length > SHARINGAN_CLIPBOARD_CHAR_LIMIT) {
      const filename = sharinganFilename();
      let realPath;
      try {
        realPath = await saveMarkdownFile(text, filename);
      } catch (err) {
        showDownloadError(err);
        return;
      }
      const fallback = appendSharinganDownloadReference(buildPromptText(), filename, text.length, realPath);
      const result = await writeToClipboard(fallback);
      showClipboardFeedback(result, requestToken, "exported");
      return;
    }
    const result = await writeToClipboard(text);
    showClipboardFeedback(result, requestToken);
  }

  // ── ⌘M — copy as Markdown ──────────────────────────────────
  const MARKDOWN_BLOCK_TAGS = new Set(["address","article","aside","blockquote","dd","details","div","dl","dt","figcaption","figure","footer","form","h1","h2","h3","h4","h5","h6","header","hr","li","main","nav","ol","p","pre","section","table","ul"]);

  function mdCollapse(s) { return String(s || "").replace(/[\t\n\r ]+/g, " "); }
  // Position-sensitive escaping: inline-anywhere metas everywhere, line-leading
  // constructs (#, >, lists) only at the node start — escaping every ".-()!"
  // drowned prose in noise ("e\.g\.") without adding safety.
  function mdEscape(s) {
    return String(s || "")
      .replace(/([\\`*_\[\]<])/g, "\\$1")
      .replace(/~~/g, "\\~~")
      .replace(/^(\s*)(#{1,6})(\s|$)/, "$1\\$2$3")
      .replace(/^(\s*)>/, "$1\\>")
      .replace(/^(\s*)([-+])(\s)/, "$1\\$2$3")
      .replace(/^(\s*)(\d+)\.(\s)/, "$1$2\\.$3");
  }
  function mdEscapeCell(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n+/g, "<br>"); }
  function mdResolve(raw, el) {
    if (!raw) return "";
    try { return new URL(raw, (el && el.baseURI) || location.href).href; } catch (_) { return raw; }
  }
  function mdDest(url) {
    if (!url) return "";
    if (!/[ ()\x00-\x1F\x7F]/.test(url)) return url;
    if (/[\x00-\x1F\x7F]/.test(url)) { try { return encodeURI(url); } catch (_) {} }
    return "<" + url.replace(/([<>\\])/g, "\\$1") + ">";
  }
  function mdHidden(el) {
    if (!el || el.nodeType !== 1) return true;
    const tag = el.tagName.toLowerCase();
    if (/^(script|style|noscript|template|link|meta|head)$/.test(tag)) return true;
    if (isEditorElement(el) || el.hidden || el.getAttribute("aria-hidden") === "true") return true;
    try {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse") return true;
    } catch (_) {}
    return false;
  }
  function mdTopLevel(elements) {
    return elements.filter((el, i, arr) => el && el.nodeType === 1 && !arr.some((other, j) => j !== i && other && other.nodeType === 1 && other.contains(el)));
  }
  function mdImgSrc(img) {
    if (img.currentSrc) return img.currentSrc;
    const srcset = img.getAttribute("srcset");
    if (srcset) {
      const first = srcset.split(",")[0].trim().split(/\s+/)[0];
      if (first) return mdResolve(first, img);
    }
    return img.src || mdResolve(img.getAttribute("src"), img);
  }
  function mdInlineChildren(el) { return Array.from(el.childNodes).map(mdInlineNode).join(""); }
  function mdInlineNode(node) {
    if (node.nodeType === 3) return mdEscape(mdCollapse(node.nodeValue));
    if (node.nodeType !== 1 || mdHidden(node)) return "";
    const tag = node.tagName.toLowerCase();
    if (tag === "br") return "  \n";
    if (tag === "strong" || tag === "b") { const s = mdInlineChildren(node).trim(); return s ? `**${s}**` : ""; }
    if (tag === "em" || tag === "i") { const s = mdInlineChildren(node).trim(); return s ? `*${s}*` : ""; }
    if (tag === "del" || tag === "s" || tag === "strike") { const s = mdInlineChildren(node).trim(); return s ? `~~${s}~~` : ""; }
    if (tag === "code" && !(node.parentElement && node.parentElement.tagName && node.parentElement.tagName.toLowerCase() === "pre")) {
      const raw = node.textContent || "";
      if (!raw) return "";
      const longest = Math.max(0, ...((raw.match(/`+/g) || []).map(run => run.length)));
      const ticks = "`".repeat(Math.max(1, longest + 1));
      const pad = /^`|`$/.test(raw) || ticks.length > 1 ? " " : "";
      return ticks + pad + raw + pad + ticks;
    }
    if (tag === "a") {
      let text = mdInlineChildren(node).trim();
      const href = node.getAttribute("href");
      const url = /^(?:javascript:|mailto:|tel:|#)/i.test(href || "") ? href : (node.href || mdResolve(href, node));
      if (!url) return text;
      if (!text) text = url;
      return `[${text}](${mdDest(url)})`;
    }
    if (tag === "img") {
      const src = mdImgSrc(node);
      if (!src) return "";
      const alt = (node.getAttribute("alt") || "").replace(/[\[\]]/g, "");
      return `![${alt}](${mdDest(src)})`;
    }
    return mdInlineChildren(node);
  }
  function mdFence(code) {
    const longest = Math.max(0, ...((code.match(/`+/g) || []).map(run => run.length)));
    return "`".repeat(Math.max(3, longest + 1));
  }
  function mdPreText(root) {
    let out = "";
    const gutter = /(?:^|\s)(?:line-numbers?(?:-rows)?|line-?number|linenos?|hljs-ln-numbers?|gutter)(?:\s|$)/i;
    (function walk(node) {
      for (const ch of Array.from(node.childNodes)) {
        if (ch.nodeType === 3) { out += ch.nodeValue; continue; }
        if (ch.nodeType !== 1) continue;
        if (ch.tagName.toLowerCase() === "br") { out += "\n"; continue; }
        if (gutter.test(typeof ch.className === "string" ? ch.className : "") || ch.hidden || ch.getAttribute("aria-hidden") === "true") continue;
        walk(ch);
      }
    })(root);
    return out;
  }
  function mdCodeLang(el) {
    const probes = [el, el.querySelector && el.querySelector("code")].filter(Boolean);
    for (const node of probes) {
      const classes = String(node.className || "").split(/\s+/);
      for (const c of classes) {
        const m = c.match(/^(?:language|lang|highlight-source)-?([a-z0-9#+]+)$/i);
        if (m) return m[1].toLowerCase();
      }
    }
    return "";
  }
  function mdBlock(el) {
    if (!el || mdHidden(el)) return "";
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      const text = mdInlineChildren(el).replace(/\n+/g, " ").trim();
      return text ? "#".repeat(Number(tag[1])) + " " + text : "";
    }
    if (tag === "hr") return "---";
    if (tag === "pre") {
      const codeEl = el.querySelector("code");
      // textContent flattens <br>-separated code onto one line and includes
      // highlighter line-number gutters — walk instead.
      const code = mdPreText(codeEl || el).replace(/\r\n?/g, "\n").replace(/^\n|\n[ \t]*$/g, "");
      const fence = mdFence(code);
      return fence + mdCodeLang(el) + "\n" + code + "\n" + fence;
    }
    if (tag === "blockquote") {
      const inner = mdFlow(el);
      return inner ? inner.split("\n").map(line => line ? "> " + line : ">").join("\n") : "";
    }
    if (tag === "ul" || tag === "ol") return mdList(el, tag === "ol", 0);
    if (tag === "table") return mdTable(el);
    if (tag === "img" || tag === "a") return mdInlineNode(el).trim();
    return mdFlow(el);
  }
  function mdFlow(el) {
    const blocks = [];
    let inline = "";
    const flush = () => {
      const s = inline.replace(/[ \t]+\n/g, "\n").trim();
      if (s) blocks.push(s);
      inline = "";
    };
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === 3) { inline += mdEscape(mdCollapse(node.nodeValue)); continue; }
      if (node.nodeType !== 1 || mdHidden(node)) continue;
      const tag = node.tagName.toLowerCase();
      if (MARKDOWN_BLOCK_TAGS.has(tag)) { flush(); const b = mdBlock(node); if (b) blocks.push(b); }
      else inline += mdInlineNode(node);
    }
    flush();
    return blocks.join("\n\n");
  }
  function mdList(list, ordered, depth) {
    const lines = [];
    let index = ordered ? (parseInt(list.getAttribute("start"), 10) || 1) : 1;
    for (const li of Array.from(list.children)) {
      if (!li || li.tagName.toLowerCase() !== "li" || mdHidden(li)) continue;
      const marker = ordered ? `${index++}. ` : "- ";
      const nested = [];
      const lead = [];
      let inline = "";
      for (const node of Array.from(li.childNodes)) {
        if (node.nodeType === 3) { inline += mdEscape(mdCollapse(node.nodeValue)); continue; }
        if (node.nodeType !== 1 || mdHidden(node)) continue;
        const tag = node.tagName.toLowerCase();
        if (tag === "ul" || tag === "ol") { if (inline.trim()) { lead.push(inline.trim()); inline = ""; } nested.push(mdList(node, tag === "ol", depth + 1)); }
        else if (MARKDOWN_BLOCK_TAGS.has(tag)) { if (inline.trim()) { lead.push(inline.trim()); inline = ""; } const b = mdBlock(node); if (b) lead.push(b); }
        else inline += mdInlineNode(node);
      }
      if (inline.trim()) lead.push(inline.trim());
      const indent = "  ".repeat(depth);
      const body = lead.join("\n\n") || "";
      lines.push(indent + marker + body.replace(/\n/g, "\n" + indent + "  "));
      nested.filter(Boolean).forEach(n => lines.push(n));
    }
    return lines.join("\n");
  }
  function mdTable(table) {
    const rows = Array.from(table.querySelectorAll("tr")).filter(row => !mdHidden(row));
    if (!rows.length) return "";
    // carry[col] = how many following rows are still covered by a rowspan cell
    // opened above; without it every row under a colspan/rowspan shifts left.
    const carry = [];
    const matrix = rows.map(row => {
      const out = [];
      let col = 0;
      const fillCarried = () => { while (carry[col] > 0) { carry[col] -= 1; out[col] = ""; col += 1; } };
      for (const cell of Array.from(row.children)) {
        if (!/^(td|th)$/i.test(cell.tagName) || mdHidden(cell)) continue;
        fillCarried();
        const text = mdEscapeCell(mdFlow(cell) || mdInlineChildren(cell)).trim();
        const span = parseInt(cell.getAttribute("colspan"), 10) || 1;
        const rspan = parseInt(cell.getAttribute("rowspan"), 10) || 1;
        for (let s = 0; s < span; s++) {
          out[col] = text;
          if (rspan > 1) carry[col] = (carry[col] || 0) + (rspan - 1);
          col += 1;
        }
      }
      fillCarried();
      for (let i = 0; i < out.length; i++) if (out[i] === undefined) out[i] = "";
      return out;
    });
    const width = Math.max(1, ...matrix.map(row => row.length));
    matrix.forEach(row => { while (row.length < width) row.push(""); });
    const header = matrix[0];
    const body = matrix.slice(1);
    return [`| ${header.join(" | ")} |`, `| ${Array(width).fill("---").join(" | ")} |`, ...body.map(row => `| ${row.join(" | ")} |`)].join("\n");
  }
  function localMarkdownPayload(elements) {
    const top = mdTopLevel(elements || []);
    const text = top.map(mdBlock).filter(Boolean).join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
    return text ? { text } : null;
  }

  // Press ⌘M to preview clean Markdown in the result panel. It uses the current
  // selection when there is one, otherwise the page's main readable content
  // (article/main/body). Press ⌘C while the panel is open to copy the Markdown.
  async function copyAsMarkdown(targetElements) {
    let els = targetElements && targetElements.length
      ? targetElements.slice()
      : selectedElements.length
      ? selectedElements.slice()
      : [document.querySelector("main, article, [role='main']") || document.body];
    els = els.filter(Boolean);
    if (!els.length) return;
    try {
      // §1.5: a null/failed host payload falls back to the built-in serializer
      // so the extension is never WORSE than the bookmarklet on the same page.
      let payload = null;
      if (HOST.buildCopyPayload) {
        // Keep the copy button responsive while the host serializer runs.
        setCopyButtonLoading(true);
        try {
          payload = await HOST.buildCopyPayload("markdown", { elements: els, lang, buildPromptText, buildSharinganReport });
        } catch (_) { payload = null; }
        setCopyButtonLoading(false);
      }
      if (!payload) payload = localMarkdownPayload(els);
      if (payload && payload.text) {
        showRevPromptPanel("mdTitle");
        pushRevToken(payload.text);
        finishRevPrompt(payload.text, "copyMarkdown", false);
      }
    } catch (_) { /* best-effort */ }
  }

  // Lightweight: a displayable thumbnail src for a selected element, or null.
  // (No canvas — used for the selection tag chip + to decide button visibility.)
  function thumbSrcForElement(el) {
    if (!el) return null;
    const img = (el.tagName === "IMG") ? el : (el.querySelector && el.querySelector("img"));
    if (img && (img.currentSrc || img.src)) return img.currentSrc || img.src;
    try {
      const bg = getComputedStyle(el).backgroundImage || "";
      const m = bg.match(/url\((?:"|')?(.*?)(?:"|')?\)/);
      if (m && m[1]) return m[1].indexOf("data:") === 0 ? m[1] : new URL(m[1], location.href).href;
    } catch (_) {}
    return null;
  }

  // ── Result preview panel: loading lives on the Copy button; the result rises in a
  // panel above the chat menu, and the Copy button is repurposed to copy that
  // panel text until the panel is closed. (revPanel / pendingGenPrompt
  // are declared with the other state vars near the top.) ─────────────────────
  function copyBtnEl() { return chatPanel && chatPanel.querySelector(`.${NS}-copy-btn`); }

  // Loading state while Markdown is prepared.
  function setCopyButtonLoading(on) {
    const btn = copyBtnEl(); if (!btn) return;
    if (copyTimer) { clearTimeout(copyTimer); copyTimer = null; }
    btn.classList.remove(`${NS}-copy-done`, `${NS}-copy-error`);
    btn.classList.toggle(`${NS}-copy-loading`, !!on);
    btn.disabled = !!on;
    if (on) btn.textContent = t("mdPreparing");
    else { btn.disabled = selectedElements.length === 0; setCopyButtonIdle(btn); }
  }

  function positionRevPanel() {
    if (!revPanel || !chatPanel) return;
    const cr = chatPanel.getBoundingClientRect();
    revPanel.style.bottom = (window.innerHeight - cr.top + 8) + "px";
    revPanel.style.right = Math.max(8, window.innerWidth - cr.right) + "px";
  }

  // Opens an empty result panel and arms the smooth typewriter reveal. Text is
  // fed in via pushRevToken() (one call per streamed token, or one big call for
  // the non-stream fallback); the reveal loop catches up smoothly either way.
  function showRevPromptPanel(titleKey) {
    closeRevPromptResult();
    revPanel = document.createElement("div");
    revPanel.className = `${NS}-root ${NS}-revprompt`;
    const head = document.createElement("div"); head.className = `${NS}-revprompt-head`;
    const title = document.createElement("span"); title.className = `${NS}-revprompt-title`; title.textContent = t(titleKey || "mdTitle");
    const close = document.createElement("button"); close.className = `${NS}-revprompt-close`; close.type = "button"; close.textContent = "×";
    close.onclick = closeRevPromptResult;
    head.appendChild(title); head.appendChild(close);
    const body = document.createElement("div"); body.className = `${NS}-revprompt-body`;
    const txt = document.createElement("div"); txt.className = `${NS}-revprompt-text`;
    body.appendChild(txt);
    revPanel.appendChild(head); revPanel.appendChild(body);
    mountSelectorSurface(revPanel);
    revStream = { target: "", shown: 0, el: txt, timer: null };
    positionRevPanel();
  }

  // setTimeout (not rAF) so the typewriter keeps progressing if the tab is
  // backgrounded mid-stream (rAF fully pauses when hidden); ~22ms ≈ 45fps.
  function revStreamStep() {
    if (!revStream) { return; }
    revStream.timer = null;
    const s = revStream.target;
    if (revStream.shown < s.length) {
      // Reveal a slice; the divisor lets it speed up to catch a fast stream.
      const el = revStream.el;
      // Follow the newest text only while the user is already near the bottom,
      // so once the panel fills (max-height) it keeps scrolling down — but we
      // don't yank them back if they scrolled up to read an earlier section.
      const stick = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      const step = Math.max(2, Math.ceil((s.length - revStream.shown) / 6));
      revStream.shown = Math.min(s.length, revStream.shown + step);
      el.textContent = s.slice(0, revStream.shown);
      if (stick) el.scrollTop = el.scrollHeight;
      revStream.timer = setTimeout(revStreamStep, 22);
    }
    // else: caught up; pushRevToken/finishRevPrompt will restart on new text.
  }
  function pushRevToken(token) {
    if (!revStream) return;
    revStream.target += token;
    if (!revStream.timer) revStream.timer = setTimeout(revStreamStep, 0);
  }

  function closeRevPromptResult() {
    if (revStream && revStream.timer) clearTimeout(revStream.timer);
    revStream = null;
    if (revPanel) { revPanel.remove(); revPanel = null; }
    if (pendingGenPrompt) {
      pendingGenPrompt = null;
      pendingResultCopyKey = null;
      const btn = copyBtnEl();
      if (btn) {
        btn.disabled = selectedElements.length === 0;
        setCopyButtonIdle(btn);
      }
    }
  }

  // When the streamed/returned result is complete: settle the panel to the full
  // text (guaranteed visible even if the reveal animation is paused — e.g. a
  // backgrounded tab where rAF doesn't fire), then repurpose Copy to the panel
  // text. Some callers still auto-copy; Markdown preview intentionally does not.
  async function finishRevPrompt(fullText, copyLabelKey, shouldCopy, requestToken) {
    if (requestToken && requestToken !== copyRequestToken) return;
    if (revStream) {
      if (revStream.timer) { clearTimeout(revStream.timer); revStream.timer = null; }
      revStream.target = fullText;
      revStream.shown = fullText.length;
      const el = revStream.el;
      if (el) {
        const stick = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        el.textContent = fullText;
        if (stick) el.scrollTop = el.scrollHeight;
      }
    }
    pendingGenPrompt = fullText;
    pendingResultCopyKey = copyLabelKey || "copyMarkdown";
    if (shouldCopy !== false) {
      const token = requestToken || ++copyRequestToken;
      const result = await writeToClipboard(fullText);
      showClipboardFeedback(result, token);
    }
    const btn = copyBtnEl();
    if (btn) {
      btn.disabled = false;
      setCopyButtonIdle(btn);
    }
  }

  // ── Screenshot capture ─────────────────────────────────────
  let screenshotTimer = null;
  function setScreenshotButtonIdle() {
    if (!screenshotBtn) return;
    screenshotBtn.innerHTML = CAMERA_SVG;
    screenshotBtn.title = t("copyScreenshot");
    screenshotBtn.setAttribute("aria-label", t("copyScreenshot"));
  }

  function showScreenshotFeedback(msg, isError, detail) {
    const btn = chatPanel.querySelector(`.${NS}-screenshot-btn`);
    if (screenshotTimer) clearTimeout(screenshotTimer);
    btn.classList.remove(`${NS}-screenshot-done`, `${NS}-screenshot-error`);
    btn.classList.add(isError ? `${NS}-screenshot-error` : `${NS}-screenshot-done`);
    btn.title = detail || msg;
    btn.setAttribute("aria-label", detail || msg);
    btn.innerHTML = isError
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
    screenshotTimer = setTimeout(() => { btn.classList.remove(`${NS}-screenshot-done`, `${NS}-screenshot-error`); setScreenshotButtonIdle(); screenshotTimer = null; }, 2400);
  }

  async function captureScreenshot(options) {
    if (selectedElements.length === 0) return;
    const opts = options || {};
    const feedbackTarget = opts.feedbackTarget || "screenshot";
    const requestToken = feedbackTarget === "copy" ? (opts.copyRequestToken || ++copyRequestToken) : null;
    const showError = (code, err) => {
      if (feedbackTarget === "copy") {
        if (requestToken !== copyRequestToken) return;
        showCopyCaptureError(code, err);
      } else showScreenshotError(code, err);
    };
    const showSuccess = (savedImage) => {
      if (feedbackTarget === "copy") {
        if (requestToken !== copyRequestToken) return;
        showCopyFeedback(savedImage ? t("copiedSaved") : t("copied"));
      } else showScreenshotFeedback(t(savedImage ? "screenshotCopiedSaved" : "screenshotCopied"));
    };
    // getDisplayMedia is only a requirement on the bookmarklet path; the
    // extension host captures via captureVisibleTab and must not be blocked
    // on pages where mediaDevices is absent (e.g. non-secure contexts).
    const hostCanCapture = !!(HOST.grabViewportFrame || HOST.captureRegion);
    if (!navigator.clipboard || (!hostCanCapture && (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia))) {
      showError("unsupported");
      return;
    }

    const imageFilename = (opts.downloadImage || HOST.autoSaveScreenshots) ? screenshotFilename() : "";
    let imageBlob;
    try {
      imageBlob = await captureScreenshotBlob();
    } catch (err) {
      showError(classifyScreenshotError(err, "capture"), err);
      return;
    }

    let imageSaved = false;
    let savedFilename = imageFilename;
    let savedPath = "";
    if (imageFilename) {
      try {
        const saveResult = await saveScreenshotImage(imageBlob, imageFilename);
        imageSaved = saveResult.saved;
        savedFilename = saveResult.filename || imageFilename;
        savedPath = saveResult.path || "";
      } catch (err) {
        showError("download", err);
        return;
      }
    }

    // Pro screenshot actions always carry the regular prompt/context text,
    // independently of the main Copy button's combined toggle. This keeps a
    // direct screenshot useful to an AI while preserving bookmarklet behavior.
    const text = Object.prototype.hasOwnProperty.call(opts, "text")
      ? opts.text
      : (HOST.screenshotClipboardContext === true ? buildPromptText() : (settings.combined ? buildPromptText() : ""));
    const textWithImagePath = imageFilename ? appendScreenshotSaveReference(text, savedFilename, imageSaved, savedPath) : text;

    try {
      if (!window.ClipboardItem) {
        showError("unsupported");
        return;
      }
      let itemData = { "image/png": imageBlob };
      if (textWithImagePath) {
        itemData = {
          "text/html": screenshotHtmlBlob(textWithImagePath, imageBlob),
          "text/plain": new Blob([textWithImagePath], { type: "text/plain" }),
          "image/png": imageBlob,
        };
      }
      await navigator.clipboard.write([new ClipboardItem(itemData)]);
      showSuccess(imageSaved);
    } catch (err) {
      showError("clipboard", err);
    }
  }

  async function saveScreenshotImage(blob, filename) {
    // Extension: save via chrome.downloads and get the REAL on-disk path back —
    // no save dialog, no path-guessing. Bookmarklet has no HOST.downloadFile and
    // falls through to the file picker / pending-save flow below, unchanged.
    if (HOST.downloadFile) {
      try {
        const res = await HOST.downloadFile(filename, blob, "image/png");
        if (res) {
          const path = res.path || "";
          const name = path ? (path.split(/[\\/]/).pop() || filename) : filename;
          return { saved: true, filename: name, path };
        }
        if (HOST.autoSaveScreenshots) throw new Error("Screenshot auto-save returned no result");
      } catch (err) {
        console.warn("[Selector] host download failed", err);
        if (HOST.autoSaveScreenshots) throw err;
      }
    }
    try {
      const result = await writeScreenshotWithPicker(blob, filename);
      clearPendingScreenshotSave();
      return result;
    } catch (err) {
      if (err && err.name === "AbortError") throw screenshotError("cancelled", err);
      console.warn("[Selector] Save picker unavailable", err);
    }

    showPendingScreenshotSave(blob, filename);
    return { saved: false, filename };
  }

  // When the Sharingan report exceeds the clipboard threshold we auto-download
  // it as a .md file and put only the short prompt summary in the clipboard.
  // Without an explicit note the receiving AI has no way to know the rich
  // report exists. This banner runs FIRST in the clipboard text so any AI
  // sees it before the abbreviated prompt body.
  function appendSharinganDownloadReference(text, filename, fullChars, realPath) {
    const head = `Sharingan replication report: ${filename}  (${(fullChars / 1024).toFixed(1)} KB)`;
    const why = `The full DOM/CSS/font/animation report was downloaded as a Markdown file (it exceeded the clipboard size limit). The prompt body below is only an abbreviated summary — for high-fidelity replication, read the .md file.`;
    // Extension: reference the real on-disk path; bookmarklet: mdfind/find guess.
    const locate = realPath
      ? [`Saved to: ${realPath}`]
      : [
          `To locate the absolute path, run one of:`,
          `  mdfind -name "${filename}"                              # macOS`,
          `  find ~ -name "${filename}" -mtime -1                   # Linux / WSL`,
        ];
    const ref = [head, why].concat(locate).join("\n");
    return text ? `${ref}\n\n${text}` : ref;
  }

  // Save a Markdown report. Extension → chrome.downloads (returns real path);
  // bookmarklet → anchor download (no path). Returns the absolute path or "".
  async function saveMarkdownFile(text, filename) {
    if (HOST.downloadFile) {
      const res = await HOST.downloadFile(filename, new Blob([text], { type: "text/markdown" }), "text/markdown");
      if (res && res.path) return res.path;
      throw new Error("Markdown save completed without a real path");
    }
    downloadMarkdown(text, filename);
    return "";
  }

  // The browser does not expose the absolute path the user picked in the save
  // dialog (sandbox), so we hand the receiving AI a concrete locator command
  // it can run instead. The filename is timestamp-unique so a system-wide
  // search returns exactly one hit.
  function appendScreenshotSaveReference(text, filename, saved, realPath) {
    // Extension: chrome.downloads gave us the actual absolute path — reference it
    // directly. (The mdfind/find guesswork below is only for the bookmarklet,
    // where the browser never exposes the chosen path.)
    if (realPath) {
      const ref = `Screenshot saved to: ${realPath}`;
      return text ? `${text}\n\n${ref}` : ref;
    }
    const lines = saved
      ? [
          `Screenshot file: ${filename}`,
          `The user saved this PNG via the browser save dialog (path not exposed by the browser).`,
          `To locate the absolute path, run one of:`,
          `  mdfind -name "${filename}"                              # macOS`,
          `  find ~ -name "${filename}" -mtime -1                   # Linux / WSL`,
        ]
      : [
          `Screenshot file: ${filename}  (capture pending)`,
          `Auto-save did not run — ask the user to click "Save PNG" in the Selector panel and pick a folder.`,
          `After saving, locate it with:`,
          `  mdfind -name "${filename}"                              # macOS`,
          `  find ~ -name "${filename}" -mtime -1                   # Linux / WSL`,
        ];
    const ref = lines.join("\n");
    return text ? `${text}\n\n${ref}` : ref;
  }

  async function writeScreenshotWithPicker(blob, filename) {
    if (!window.showSaveFilePicker || !window.isSecureContext) throw new Error("File picker unavailable");
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: "PNG image", accept: { "image/png": [".png"] } }],
      excludeAcceptAllOption: false,
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { saved: true, filename: handle.name || filename };
  }

  function showPendingScreenshotSave(blob, filename) {
    pendingScreenshotSave = { blob, filename };
    if (!saveBtn) return;
    saveBtn.textContent = t("savePng");
    saveBtn.classList.remove(`${NS}-hidden`);
  }

  function clearPendingScreenshotSave() {
    pendingScreenshotSave = null;
    if (saveBtn) saveBtn.classList.add(`${NS}-hidden`);
  }

  async function savePendingScreenshot() {
    if (!pendingScreenshotSave) return;
    const pending = pendingScreenshotSave;
    saveBtn.disabled = true;
    try {
      await writeScreenshotWithPicker(pending.blob, pending.filename);
      clearPendingScreenshotSave();
      showCopyFeedback(t("copiedSaved"));
    } catch (err) {
      if (err && err.name !== "AbortError") showCopyCaptureError("capture", err);
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  function screenshotErrorKey(code) {
    return {
      unsupported: "errUnsupported",
      cancelled: "errCancelled",
      permission: "errPermission",
      clipboard: "errClipboard",
      download: "errDownload",
      empty: "errEmpty",
      capture: "errCapture",
    }[code] || "errCapture";
  }

  function showScreenshotError(code, err) {
    const key = screenshotErrorKey(code);
    const detail = err ? `${err.name || "Error"}: ${err.message || String(err)}` : "";
    if (err) console.warn(`[Selector] ${t(key)}`, err);
    showScreenshotFeedback(t(key), true, detail);
  }

  function screenshotError(code, cause) {
    const err = new Error(cause && cause.message ? cause.message : code);
    err.name = cause && cause.name ? cause.name : "SelectorScreenshotError";
    err.selectorCode = code;
    err.cause = cause;
    return err;
  }

  function classifyScreenshotError(err, stage) {
    if (!err) return stage === "clipboard" ? "clipboard" : "capture";
    if (err.selectorCode) return err.selectorCode;
    if (stage === "clipboard") return "clipboard";
    const name = err.name || "";
    const message = String(err.message || "").toLowerCase();
    if (name === "NotAllowedError" || message.includes("permission")) {
      if (message.includes("system") || message.includes("denied")) return "permission";
      return "cancelled";
    }
    if (name === "SecurityError") return "permission";
    return "capture";
  }

  function defer() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  }

  // ── Screenshot capture dispatcher (HOST_CONTRACT.md §1.3) ────
  // Early split keeps the bookmarklet path byte-for-byte identical: when the
  // Host provides grabViewportFrame (extension uses captureVisibleTab) we use
  // the no-prompt host path; otherwise the existing getDisplayMedia path runs.
  async function captureScreenshotBlob() {
    // ── Full-element / full-page region capture (HOST_CONTRACT.md §10) ──
    // Bookmarklet has no HOST.captureRegion → this whole branch is skipped and the
    // original viewport dispatch (getDisplayMedia path) runs byte-for-byte.
    const scope = (settings && settings.screenshotScope) || "viewport";
    if (scope !== "viewport" && HOST.captureRegion) {
      const editorEls = document.querySelectorAll(`.${NS}-root, .${NS}-hover-box, .${NS}-sel-box, .${NS}-sel-corner, .${NS}-sel-label, .${NS}-annotate-btn, .${NS}-marquee`);
      const previousDisplay = Array.from(editorEls, el => [el, el.style.display]);
      try {
        editorEls.forEach(el => { el.style.display = "none"; });
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        const dpr = window.devicePixelRatio || 1;
        const docEl = document.documentElement;
        const pageWidth = docEl.scrollWidth;
        let geom;
        if (scope === "fullPage") {
          geom = {
            x: 0,
            y: 0,
            w: pageWidth,
            h: Math.max(docEl.scrollHeight, document.body ? document.body.scrollHeight : 0),
            dpr,
            pageWidth,
          };
        } else {
          // fullElement: union of selected element rects in DOCUMENT coords.
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          selectedElements.forEach(el => {
            const r = el.getBoundingClientRect();
            minX = Math.min(minX, r.left + window.scrollX);
            minY = Math.min(minY, r.top + window.scrollY);
            maxX = Math.max(maxX, r.right + window.scrollX);
            maxY = Math.max(maxY, r.bottom + window.scrollY);
          });
          const pad = 8;
          minX = Math.max(0, Math.floor(minX - pad));
          minY = Math.max(0, Math.floor(minY - pad));
          maxX = Math.min(pageWidth, Math.ceil(maxX + pad));
          maxY = Math.ceil(maxY + pad);
          geom = { x: minX, y: minY, w: maxX - minX, h: maxY - minY, dpr, pageWidth };
        }
        if (!(geom.w > 0) || !(geom.h > 0)) throw screenshotError("empty");
        const blob = await HOST.captureRegion(scope, geom);
        if (!blob) throw screenshotError("capture");
        return blob;
      } finally {
        previousDisplay.forEach(([el, display]) => { el.style.display = display; });
      }
    }
    if (HOST.grabViewportFrame) return captureViaHost();
    return captureViaDisplayMedia();
  }

  // Extension path: grab a ready-to-draw viewport frame from the Host (already
  // physical pixels = viewport CSS px × dpr) and crop to the selection using
  // the SAME math as the getDisplayMedia path. No getDisplayMedia, no prompt.
  async function captureViaHost() {
    const editorEls = document.querySelectorAll(`.${NS}-root, .${NS}-hover-box, .${NS}-sel-box, .${NS}-sel-corner, .${NS}-sel-label, .${NS}-annotate-btn, .${NS}-marquee`);
    const previousDisplay = Array.from(editorEls, el => [el, el.style.display]);
    try {
      editorEls.forEach(el => { el.style.display = "none"; });
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const frame = await HOST.grabViewportFrame();
      const sourceWidth = frame.width || frame.naturalWidth || frame.videoWidth;
      const sourceHeight = frame.height || frame.naturalHeight || frame.videoHeight;
      const dpr = window.devicePixelRatio || 1;
      let minX=Infinity, minY=Infinity, maxX=0, maxY=0;
      selectedElements.forEach(el => { const r=el.getBoundingClientRect(); minX=Math.min(minX,r.left*dpr); minY=Math.min(minY,r.top*dpr); maxX=Math.max(maxX,r.right*dpr); maxY=Math.max(maxY,r.bottom*dpr); });
      const pad = 8 * dpr;
      minX=Math.max(0,Math.floor(minX-pad)); minY=Math.max(0,Math.floor(minY-pad));
      maxX=Math.min(sourceWidth,Math.ceil(maxX+pad)); maxY=Math.min(sourceHeight,Math.ceil(maxY+pad));
      const w=maxX-minX, h=maxY-minY;
      if (w <= 0 || h <= 0) throw screenshotError("empty");
      const canvas=document.createElement("canvas"); canvas.width=w; canvas.height=h;
      canvas.getContext("2d").drawImage(frame, minX, minY, w, h, 0, 0, w, h);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw screenshotError("capture");
      return blob;
    } finally {
      previousDisplay.forEach(([el, display]) => { el.style.display = display; });
    }
  }

  async function captureViaDisplayMedia() {
    const editorEls = document.querySelectorAll(`.${NS}-root, .${NS}-hover-box, .${NS}-sel-box, .${NS}-sel-corner, .${NS}-sel-label, .${NS}-annotate-btn, .${NS}-marquee`);
    const previousDisplay = Array.from(editorEls, el => [el, el.style.display]);
    let stream = null;

    try {
      try { stream = await navigator.mediaDevices.getDisplayMedia({ preferCurrentTab: true, video: { frameRate: 1 } }); }
      catch (err) { throw screenshotError(classifyScreenshotError(err, "capture"), err); }
      editorEls.forEach(el => { el.style.display = "none"; });
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const track = stream.getVideoTracks()[0];
      await new Promise(r => setTimeout(r, 100));
      const frame = await grabFrame(stream, track);
      const sourceWidth = frame.width || frame.videoWidth;
      const sourceHeight = frame.height || frame.videoHeight;
      const dpr = window.devicePixelRatio || 1;
      let minX=Infinity, minY=Infinity, maxX=0, maxY=0;
      selectedElements.forEach(el => { const r=el.getBoundingClientRect(); minX=Math.min(minX,r.left*dpr); minY=Math.min(minY,r.top*dpr); maxX=Math.max(maxX,r.right*dpr); maxY=Math.max(maxY,r.bottom*dpr); });
      const pad = 8 * dpr;
      minX=Math.max(0,Math.floor(minX-pad)); minY=Math.max(0,Math.floor(minY-pad));
      maxX=Math.min(sourceWidth,Math.ceil(maxX+pad)); maxY=Math.min(sourceHeight,Math.ceil(maxY+pad));
      const w=maxX-minX, h=maxY-minY;
      if (w <= 0 || h <= 0) throw screenshotError("empty");
      const canvas=document.createElement("canvas"); canvas.width=w; canvas.height=h;
      canvas.getContext("2d").drawImage(frame, minX, minY, w, h, 0, 0, w, h);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw screenshotError("capture");
      return blob;
    } finally {
      if (stream) stream.getTracks().forEach(t => t.stop());
      previousDisplay.forEach(([el, display]) => { el.style.display = display; });
    }
  }

  async function grabFrame(stream, track) {
    if (window.ImageCapture) return new ImageCapture(track).grabFrame();
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise(r => requestAnimationFrame(r));
    return video;
  }

  async function screenshotHtmlBlob(text, imageBlob) {
    const imageUrl = await blobToDataUrl(imageBlob);
    return new Blob([
      '<div data-selector-copy="screenshot-text">',
      '<pre style="white-space:pre-wrap;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;margin:0 0 12px;">',
      escapeHtml(text),
      '</pre>',
      '<img alt="Selector screenshot" src="',
      imageUrl,
      '" style="max-width:100%;height:auto;">',
      '</div>',
    ], { type: "text/html" });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("Could not encode screenshot"));
      reader.readAsDataURL(blob);
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
  }

  // ── Clipboard helpers ──────────────────────────────────────
  async function writeToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return "clipboard";
      } catch (_) {
        // Fall through to the synchronous selection-based path.
      }
    }
    return fallbackCopy(text) ? "fallback" : "failed";
  }
  function fallbackCopy(text) {
    const ta=document.createElement("textarea"); ta.value=text; ta.style.cssText="position:fixed;opacity:0;top:0;left:0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    let copied = false;
    try { copied = document.execCommand("copy"); } catch(_) {}
    ta.remove();
    return copied;
  }

  function currentPageContext() {
    try {
      const url = new URL(location.href);
      if (!url.search || location.href.length <= 160) return { page: location.href, query: "" };
      return {
        page: url.origin + url.pathname + url.hash,
        query: compactQuery(url.searchParams),
      };
    } catch(_) {
      return { page: location.href, query: "" };
    }
  }

  function compactQuery(searchParams) {
    const grouped = new Map();
    for (const [key, value] of searchParams.entries()) {
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(value);
    }
    return Array.from(grouped.entries()).map(([key, values]) => {
      const compactValues = unique(values.map(compactQueryValue));
      if (values.length > 1) {
        return compactValues.length === 1 ? `${key}=${compactValues[0]} ×${values.length}` : `${key} ×${values.length}`;
      }
      return `${key}=${compactValues[0]}`;
    }).join(", ");
  }

  function compactQueryValue(value) {
    if (!value) return "";
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return value.slice(0, 8) + "…" + value.slice(-4);
    }
    return value.length > 48 ? value.slice(0, 32) + "…" + value.slice(-8) : value;
  }

// ── Prompt building ────────────────────────────────────────
  function buildPromptText() {
    if (selectedElements.length === 0) return "";
    const pageContext = currentPageContext();
    const lines = ["Page: " + pageContext.page];
    if (pageContext.query) lines.push("Query: " + pageContext.query);
    lines.push("");
    selectedElements.forEach((el, i) => {
      const aiId = el.getAttribute(AI_ID);
      const note = annotations.get(aiId);
      const ctx = buildElementContext(el, i + 1, note);
      lines.push(`${i + 1}. ${ctx.title} <${ctx.tag}>`);
      if (ctx.selector) lines.push(`   selector: ${ctx.selector}`);
      if (ctx.locator) lines.push(`   locator: ${ctx.locator}`);
      const testLocators = hostTestLocators(el);
      if (testLocators) lines.push(`   test: ${testLocators[0]}`);
      if (ctx.inside) lines.push(`   inside: ${ctx.inside}`);
      if (ctx.source) lines.push(`   source: ${ctx.source}`);
      if (ctx.react) lines.push(`   react: ${ctx.react}`);
      if (ctx.vue) lines.push(`   vue: ${ctx.vue}`);
      if (ctx.text) lines.push(`   text: "${ctx.text}"`);
      Object.entries(ctx.dataAttrs).forEach(([k, v]) => lines.push(`   ${k}: ${v}`));
      if (ctx.visual) lines.push(`   visual: ${ctx.visual}`);
      if (ctx.layout) lines.push(`   layout: ${ctx.layout}`);
      if (ctx.parent) lines.push(`   parent: ${ctx.parent}`);
      if (ctx.outerHTML) lines.push(`   html: ${ctx.outerHTML}`);
      if (ctx.reactProps) lines.push(`   props: ${ctx.reactProps}`);
      if (note) lines.push(`   instruction: ${note}`);
    });
    return lines.join("\n");
  }

// ── Sharingan report ───────────────────────────────────────
  function buildSharinganReport() {
    if (selectedElements.length === 0) return "";
    const pageContext = currentPageContext();
    const colorScheme = (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
    const lines = [
      "# Vibe Mirror Report",
      "",
      `- Captured at: ${new Date().toISOString()}`,
      `- Page: ${location.href}`,
    ];
    if (pageContext.page && pageContext.page !== location.href) lines.push(`- Route: ${pageContext.page}`);
    if (pageContext.query) lines.push(`- Query: ${pageContext.query}`);
    lines.push(
      `- Viewport: ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio || 1}x`,
      `- Scroll: ${Math.round(window.scrollX || window.pageXOffset || 0)},${Math.round(window.scrollY || window.pageYOffset || 0)}`,
      `- Color scheme: ${colorScheme}`,
      `- Selected: ${selectedElements.length}`,
      ""
    );

    appendMarkdownSection(lines, "Document Context", codeBlock(getDocumentContextReport(), "text"));

    try {
      selectedElements.forEach((el, i) => {
        perElementEmittedRules = new Set();
        const aiId = el.getAttribute(AI_ID);
        const note = annotations.get(aiId);
        const ctx = buildElementContext(el, i + 1, note);
        const replicaRoot = getReplicaRoot(el);
        lines.push(`## Element ${i + 1}: ${ctx.title} <${ctx.tag}>`, "");
        if (note) appendMarkdownSection(lines, "Instruction", note);
        appendMarkdownSection(lines, "Identity", codeBlock(getIdentityReport(el, ctx), "text"));
        const testLocators = hostTestLocators(el);
        if (testLocators) appendMarkdownSection(lines, "Test Locators", codeBlock(testLocators.join("\n"), "js"));
        appendMarkdownSection(lines, "Geometry", codeBlock(getGeometryReport(el), "text"));
        const rootReport = getReplicaRootReport(el, replicaRoot);
        if (rootReport) appendMarkdownSection(lines, "Replica Root", codeBlock(rootReport, "text"));
        appendMarkdownSection(lines, "DOM Snapshot", codeBlock(sanitizedOuterHtml(el), "html"));
        const sprite = getSvgSpriteReport(el);
        if (sprite) appendMarkdownSection(lines, "Referenced SVG Symbols", codeBlock(sprite, "html"));
        const parentSnapshot = getParentSnapshotReport(el, i + 1);
        if (parentSnapshot) appendMarkdownSection(lines, "Parent Snapshot", codeBlock(parentSnapshot, "html"));
        const runtime = getRuntimeStateReport(el);
        if (runtime) appendMarkdownSection(lines, "Runtime State", codeBlock(runtime, "text"));
        const textDiff = getTextContentDiffReport(el);
        if (textDiff) appendMarkdownSection(lines, "Text Content", codeBlock(textDiff, "text"));
        appendMarkdownSection(lines, "Effective Style", codeBlock(getComputedStyleReport(el), "css"));
        const vars = getCssVariablesReport(el);
        if (vars && vars !== "none") appendMarkdownSection(lines, "CSS Custom Properties", codeBlock(vars, "css"));
        const stylePack = getReplicaStylePackReport(replicaRoot, el);
        if (stylePack) appendMarkdownSection(lines, "Replica Style Pack", codeBlock(stylePack, "text"));
        const normal = getMatchedCssRulesReport(el);
        if (normal) appendMarkdownSection(lines, "Matched Rules", codeBlock(normal, "css"));
        const interactive = getInteractiveStatesReport(el);
        if (interactive) appendMarkdownSection(lines, "Interactive State Rules", codeBlock(interactive, "css"));
        const colorRules = getColorSchemeRulesReport(el);
        if (colorRules) appendMarkdownSection(lines, "Color Scheme Rules", codeBlock(colorRules, "css"));
        const ancestors = getAncestorChainReport(el);
        if (ancestors) appendMarkdownSection(lines, "Ancestor Chain", codeBlock(ancestors, "text"));
        const pseudo = getPseudoElementsReport(el);
        if (pseudo) appendMarkdownSection(lines, "Pseudo Elements", codeBlock(pseudo, "css"));
        const fontUsage = getFontUsageReport(replicaRoot, el);
        if (fontUsage) appendMarkdownSection(lines, "Font Usage", codeBlock(fontUsage, "text"));
        const fonts = getFontFacesReport(replicaRoot || el);
        if (fonts) appendMarkdownSection(lines, "Font Faces", codeBlock(fonts, "css"));
        const animationRuntime = getAnimationRuntimeReport(replicaRoot || el, el);
        if (animationRuntime) appendMarkdownSection(lines, "Animation Runtime", codeBlock(animationRuntime, "text"));
        const keyframes = getKeyframesReport(replicaRoot || el);
        if (keyframes) appendMarkdownSection(lines, "Keyframes", codeBlock(keyframes, "css"));
        const media = getMediaAssetsReport(el);
        if (media) appendMarkdownSection(lines, "Media Assets", codeBlock(media, "text"));
        const outline = getChildrenOutlineReport(el);
        if (outline) appendMarkdownSection(lines, "Children Outline", codeBlock(outline, "text"));
        const react = getReactDetailsReport(el);
        if (react && react !== "none") appendMarkdownSection(lines, "React Details", codeBlock(react, "json"));
        const vue = getVueDetailsReport(el);
        if (vue && vue !== "none") appendMarkdownSection(lines, "Vue Details", codeBlock(vue, "json"));
        appendMarkdownSection(lines, "Context", codeBlock(getContextReport(el), "text"));
      });
    } finally {
      releaseStyleBaseline();
      perElementEmittedRules = null;
    }

    return lines.join("\n");
  }

  function appendMarkdownSection(lines, title, body) {
    if (!body) return;
    lines.push(`### ${title}`, "", body, "");
  }

  function codeBlock(value, lang) {
    value = value == null ? "" : String(value);
    const runs = value.match(/`{3,}/g);
    const size = runs ? Math.max(...runs.map(run => run.length)) + 1 : 3;
    const fence = "`".repeat(size);
    return `${fence}${lang || ""}\n${value}\n${fence}`;
  }

  function sharinganFilename() {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const slug = safeFilename((document.title || location.hostname || "page").slice(0, 48)) || "page";
    return `vibe-mirror-${slug}-${stamp}.md`;
  }

  function screenshotFilename() {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const slug = safeFilename((document.title || location.hostname || "page").slice(0, 42)) || "page";
    return `selector-screenshot-${slug}-${stamp}.png`;
  }

  function appendScreenshotReference(text, filename) {
    const path = `~/Downloads/${filename}`;
    const ref = `Screenshot file: ${path}`;
    return text ? `${text}\n\n${ref}` : ref;
  }

  function safeFilename(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-").replace(/^-+|-+$/g, "");
  }

  function downloadMarkdown(text, filename) {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    downloadBlob(blob, filename);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function getIdentityReport(el, ctx) {
    const rows = [
      ["tag", el.tagName.toLowerCase()],
      ["role", explicitOrImplicitRole(el) || ""],
      ["label", accessibleLabel(el) || ""],
      ["selector", ctx.selector || buildSelector(el)],
      ["locator", ctx.locator],
      ["xpath", buildXPath(el)],
      ["domPath", buildDomPath(el)],
      ["source", ctx.source],
      ["react", ctx.react],
      ["vue", ctx.vue],
      ["aiId", el.getAttribute(AI_ID)],
    ];
    return rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n") || "none";
  }

  function getGeometryReport(el) {
    const r = el.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const rows = [
      `viewport: x=${round2(r.x)} y=${round2(r.y)} w=${round2(r.width)} h=${round2(r.height)}`,
      `document: x=${round2(r.left + scrollX)} y=${round2(r.top + scrollY)}`,
    ];
    const box = `offset=${el.offsetWidth || 0}x${el.offsetHeight || 0} client=${el.clientWidth || 0}x${el.clientHeight || 0} scroll=${el.scrollWidth || 0}x${el.scrollHeight || 0}`;
    if (box !== "offset=0x0 client=0x0 scroll=0x0") rows.push(`box: ${box}`);
    return rows.join("\n");
  }

  // Replica Root — the selected element is often only a rendering layer
  // (for example an SVG wire layer). For faithful reconstruction we also name
  // the nearest visual module root that owns the surrounding siblings.
  const REPLICA_ROOT_CLASS_HINT = /(stage|scene|diagram|canvas|module|widget|panel|card|hero|section|shell|surface|frame|board|graph|chart|flow|timeline|workspace|viewport)/i;
  const REPLICA_ROOT_TAGS = new Set(["section","article","main","aside","nav","header","footer","figure"]);

  function getReplicaRoot(el) {
    if (!el || !el.parentElement) return el;
    const selected = safeRect(el);
    let node = el.parentElement;
    let best = node;
    let depth = 0;
    while (node && node !== document.body && node !== document.documentElement && depth++ < 12) {
      if (isEditorElement(node)) { node = node.parentElement; continue; }
      const rect = safeRect(node);
      if (rect.width < 16 || rect.height < 16) { node = node.parentElement; continue; }
      const signal = replicaRootSignal(node);
      const surroundsSelected = rect.width >= selected.width && rect.height >= selected.height;
      if (signal && surroundsSelected) {
        best = node;
        if (/stage|scene|diagram|canvas|widget|module|flow|chart|graph/i.test(signal)) return node;
      }
      node = node.parentElement;
    }
    return best || el;
  }

  function replicaRootSignal(node) {
    const tag = (node.tagName || "").toLowerCase();
    const cls = Array.from(node.classList || []).join(" ");
    const id = node.id || "";
    const role = node.getAttribute && (node.getAttribute("role") || "");
    const data = node.getAttribute && (node.getAttribute("data-node") || node.getAttribute("data-section") || "");
    const haystack = `${tag} ${id} ${cls} ${role} ${data}`;
    const hinted = haystack.match(REPLICA_ROOT_CLASS_HINT);
    if (hinted) return hinted[0];
    if (REPLICA_ROOT_TAGS.has(tag)) return tag;
    const children = Array.from(node.children || []).filter(child => !isEditorElement(child));
    if (children.length >= 3) return "multi-child-container";
    return "";
  }

  function getReplicaRootReport(el, root) {
    if (!root || root === el) return "";
    const rr = safeRect(root);
    const er = safeRect(el);
    const children = Array.from(root.children || []).filter(child => !isEditorElement(child));
    return [
      `root: ${describeElement(root)}`,
      `reason: nearest visual module/container around selected element`,
      `root viewport: x=${round2(rr.x)} y=${round2(rr.y)} w=${round2(rr.width)} h=${round2(rr.height)}`,
      `selected within root: x=${round2(er.x - rr.x)} y=${round2(er.y - rr.y)} w=${round2(er.width)} h=${round2(er.height)}`,
      children.length ? `direct children: ${children.length}` : "",
      `relation: ${root === el.parentElement ? "selected element is a direct child of this root" : "selected element is nested inside this root"}`,
    ].filter(Boolean).join("\n");
  }

  function safeRect(el) {
    try { return el.getBoundingClientRect(); }
    catch (_) { return { x: 0, y: 0, left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }; }
  }

  function sanitizedOuterHtml(el) {
    const imageInlines = buildImageInlineMap(el);
    const clone = el.cloneNode(true);
    sanitizeReportClone(clone);
    applyImageInlineMap(el, clone, imageInlines);
    const html = clone.outerHTML || "";
    const limited = limitText(html, 200000, "HTML truncated");
    sharinganDomTruncated = limited.length !== html.length;
    return limited;
  }

  let sharinganDomTruncated = false;

  // Inline same-origin (or CORS-OK) <img> sources as data URLs via canvas
  // drawing — synchronous because the browser already cached/decoded the pixels.
  // Skips huge images and CORS-tainted sources (canvas.toDataURL throws).
  const IMAGE_INLINE_PIXEL_LIMIT = Number(HOST.imageInlinePixelLimit) || 1_000_000;
  const IMAGE_INLINE_DATAURL_LIMIT = 120_000;  // ~90KB binary

  function buildImageInlineMap(root) {
    const map = new Map();
    const imgs = root.tagName && root.tagName.toLowerCase() === "img"
      ? [root]
      : (root.querySelectorAll ? Array.from(root.querySelectorAll("img")) : []);
    imgs.forEach(img => {
      if (!img.complete || !img.naturalWidth || !img.naturalHeight) return;
      const src = img.getAttribute("src") || "";
      if (!src || src.startsWith("data:")) return;
      if (img.naturalWidth * img.naturalHeight > IMAGE_INLINE_PIXEL_LIMIT) return;
      // ── Host asset cache seam (HOST_CONTRACT.md §1.4) ─────────
      // The extension can inline ANY origin. copyPrompt() pre-warms an async
      // cross-origin fetch cache via HOST.prepareAssets() BEFORE this synchronous
      // pipeline runs, then exposes a SYNCHRONOUS cache lookup here. A cache hit
      // short-circuits the same-origin-only canvas path below; a miss falls
      // through to the EXISTING canvas inlining (bookmarklet path, unchanged).
      if (HOST.cachedAssetDataURL) {
        try {
          const hosted = HOST.cachedAssetDataURL(src);
          if (hosted && typeof hosted === "string" && hosted.indexOf("data:") === 0) {
            map.set(img, hosted);
            return;
          }
        } catch (_) { /* fall through to same-origin canvas inlining */ }
      }
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL();
        if (dataURL.length > IMAGE_INLINE_DATAURL_LIMIT) return;
        map.set(img, dataURL);
      } catch (_) { /* tainted by CORS — skip silently */ }
    });
    return map;
  }

  function applyImageInlineMap(original, clone, map) {
    if (!map.size) return;
    const origImgs = original.tagName && original.tagName.toLowerCase() === "img"
      ? [original]
      : Array.from(original.querySelectorAll("img"));
    const cloneImgs = clone.tagName && clone.tagName.toLowerCase() === "img"
      ? [clone]
      : Array.from(clone.querySelectorAll("img"));
    origImgs.forEach((origImg, i) => {
      const inlined = map.get(origImg);
      if (!inlined) return;
      const target = cloneImgs[i];
      if (!target) return;
      target.setAttribute("src", inlined);
      target.removeAttribute("srcset");  // inlined dataURL trumps srcset
    });
  }

  function sanitizeReportClone(root) {
    if (!root || root.nodeType !== 1) return;
    const nodes = [root, ...Array.from(root.querySelectorAll("*"))];
    nodes.forEach(node => {
      node.removeAttribute(AI_ID);
      if (isEditorElement(node)) { node.remove(); return; }
      for (const attr of Array.from(node.attributes || [])) {
        if (isSensitiveName(attr.name) || isTokenLikeValue(attr.value)) node.setAttribute(attr.name, maskedValue(attr.value));
      }
      if (/^(input|textarea)$/i.test(node.tagName || "")) {
        const type = (node.getAttribute("type") || "").toLowerCase();
        if (type === "password") node.setAttribute("value", "[masked password]");
      }
    });
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let textNode;
    while ((textNode = walker.nextNode())) {
      const original = textNode.nodeValue || "";
      const masked = maskSensitiveText(original);
      if (masked !== original) textNode.nodeValue = masked;
    }
  }

  // Parent Snapshot — outerHTML of el.parentElement with the selected element
  // itself replaced by a marker comment (avoids double-emitting the selected
  // element's DOM, which already appears in DOM Snapshot above). Siblings get
  // sanitized + image-inlined identically to DOM Snapshot. When parent has
  // many children (e.g. a long list) we keep head 12 + tail 12 + the selected
  // element and replace the middle with an "omitted" comment.
  const PARENT_SNAPSHOT_TOTAL_CAP = 100000;
  const PARENT_SNAPSHOT_KEEP_HEAD = 12;
  const PARENT_SNAPSHOT_KEEP_TAIL = 12;
  const PARENT_SNAPSHOT_MAX_KEEP = 30;

  function getParentSnapshotReport(el, elementOrdinal) {
    const parent = el.parentElement;
    if (!parent || parent === document.body || parent === document.documentElement) return "";
    const siblings = Array.from(parent.children || []).filter(c => !isEditorElement(c));
    if (siblings.length <= 1) return "";  // no siblings → nothing meaningful beyond DOM Snapshot
    const idx = siblings.indexOf(el);
    if (idx < 0) return "";
    const total = siblings.length;

    let keep;
    if (total <= PARENT_SNAPSHOT_MAX_KEEP) {
      keep = siblings.map((_, i) => i);
    } else {
      const set = new Set();
      for (let i = 0; i < PARENT_SNAPSHOT_KEEP_HEAD; i++) set.add(i);
      for (let i = Math.max(0, total - PARENT_SNAPSHOT_KEEP_TAIL); i < total; i++) set.add(i);
      set.add(idx);
      keep = Array.from(set).sort((a, b) => a - b);
    }

    const parentClone = parent.cloneNode(false);  // shallow — we'll append manually
    sanitizeReportClone(parentClone);              // sanitize parent's own attrs

    let lastKept = -1;
    keep.forEach(i => {
      if (i > lastKept + 1) {
        const skipped = i - lastKept - 1;
        parentClone.appendChild(
          document.createComment(` … ${skipped} sibling${skipped > 1 ? "s" : ""} omitted (indices ${lastKept + 2}-${i}) … `)
        );
      }
      lastKept = i;
      if (i === idx) {
        parentClone.appendChild(
          document.createComment(` ◇ SELECTED ELEMENT ${elementOrdinal} — see DOM Snapshot above ◇ `)
        );
        return;
      }
      const sib = siblings[i];
      const sibClone = sib.cloneNode(true);
      sanitizeReportClone(sibClone);
      const inlines = buildImageInlineMap(sib);
      applyImageInlineMap(sib, sibClone, inlines);
      parentClone.appendChild(sibClone);
    });
    if (lastKept < total - 1) {
      const skipped = total - 1 - lastKept;
      parentClone.appendChild(
        document.createComment(` … ${skipped} sibling${skipped > 1 ? "s" : ""} omitted (tail, indices ${lastKept + 2}-${total}) … `)
      );
    }

    const html = parentClone.outerHTML || "";
    return limitText(html, PARENT_SNAPSHOT_TOTAL_CAP, "Parent snapshot truncated");
  }

  function maskSensitiveText(text) {
    if (!text || text.length < 20) return text;
    return String(text)
      .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b/g, "[masked jwt]")
      .replace(/\b(sk|pk|rk)-[A-Za-z0-9]{20,}\b/g, "[masked api key]")
      .replace(/\bghp_[A-Za-z0-9]{20,}\b/g, "[masked github token]")
      .replace(/\b(AIza|AKIA|ASIA)[A-Za-z0-9_-]{16,}\b/g, "[masked cloud key]")
      .replace(/\bBearer\s+[A-Za-z0-9._-]{20,}/gi, "Bearer [masked]");
  }

  // Runtime-only state — properties that are NOT visible in the DOM Snapshot (the
  // snapshot already shows every attribute and the current "value" attribute).
  // We deliberately exclude data also visible in outerHTML.
  function getRuntimeStateReport(el) {
    const rows = elementStateRows(el);
    const descendants = formDescendantStateRows(el);
    if (descendants.length) {
      if (rows.length) rows.push("");
      rows.push("[form descendants]", ...descendants);
    }
    return rows.length ? rows.join("\n") : "";
  }

  function elementStateRows(el) {
    const rows = [];
    if (/^(input|textarea|select)$/i.test(el.tagName || "") && "value" in el) {
      const attrValue = el.getAttribute("value");
      if (el.value !== (attrValue == null ? "" : attrValue)) {
        rows.push(`value: ${safeReportValue(el.getAttribute("name") || "value", el.value, 5000)}`);
      }
    }
    if ("checked" in el && el.checked !== el.hasAttribute("checked")) rows.push(`checked: ${!!el.checked}`);
    if ("selected" in el && el.selected !== el.hasAttribute("selected")) rows.push(`selected: ${!!el.selected}`);
    if ("disabled" in el && el.disabled !== el.hasAttribute("disabled")) rows.push(`disabled: ${!!el.disabled}`);
    if ("open" in el && el.open !== el.hasAttribute("open")) rows.push(`open: ${!!el.open}`);
    return rows;
  }

  function formDescendantStateRows(el) {
    const fields = Array.from(el.querySelectorAll ? el.querySelectorAll("input,textarea,select,option") : []).slice(0, 40);
    const rows = fields.map(field => {
      const name = field.getAttribute("name") || field.getAttribute("aria-label") || field.getAttribute("placeholder") || "";
      const value = "value" in field ? safeReportValue(name || "value", field.value, 1000) : "";
      const flags = [];
      if ("checked" in field) flags.push(`checked=${!!field.checked}`);
      if ("selected" in field) flags.push(`selected=${!!field.selected}`);
      if ("disabled" in field) flags.push(`disabled=${!!field.disabled}`);
      return `${describeElement(field)}${name ? ` name="${name}"` : ""}${value ? ` value="${value}"` : ""}${flags.length ? ` ${flags.join(" ")}` : ""}`;
    });
    if (fields.length === 40 && el.querySelectorAll("input,textarea,select,option").length > 40) rows.push("... form state truncated after 40 descendants");
    return rows;
  }

  // Effective Style — output only values that diverge from BOTH:
  //   1. the browser baseline for the tag (computed in an `all:initial` host)
  //   2. the page's root/body style for inherited properties (color, font-*)
  // Document Context already prints the root font/color, and CSS Custom
  // Properties are deduped against :root — so an inherited value that equals
  // root is silently dropped here.
  //
  // STYLE_REDUNDANT is a blocklist for the "other" sweep — CSS Logical
  // Properties (block-size, inset-*-end, border-block-*) and WebKit aliases
  // (-webkit-text-fill-color, -webkit-locale, text-rendering) are physical
  // equivalents of properties already in STYLE_GROUPS and pollute the report.
  const STYLE_GROUPS = [
    ["layout", ["display","position","top","right","bottom","left","z-index","float","clear","box-sizing","visibility","opacity","pointer-events","cursor","contain","isolation"]],
    ["box", ["width","height","min-width","max-width","min-height","max-height","margin-top","margin-right","margin-bottom","margin-left","padding-top","padding-right","padding-bottom","padding-left","overflow","overflow-x","overflow-y"]],
    ["border", ["border-top-width","border-right-width","border-bottom-width","border-left-width","border-top-style","border-right-style","border-bottom-style","border-left-style","border-top-color","border-right-color","border-bottom-color","border-left-color","border-radius","border-top-left-radius","border-top-right-radius","border-bottom-right-radius","border-bottom-left-radius","outline-width","outline-style","outline-color","outline-offset"]],
    ["flex-grid", ["flex-direction","flex-wrap","flex-grow","flex-shrink","flex-basis","align-items","align-content","align-self","justify-content","justify-items","justify-self","gap","row-gap","column-gap","grid-template-columns","grid-template-rows","grid-auto-columns","grid-auto-rows","grid-auto-flow","grid-column","grid-row"]],
    ["typography", ["font-family","font-size","font-weight","font-style","font-stretch","line-height","letter-spacing","text-align","text-transform","text-decoration-line","text-decoration-style","text-decoration-color","white-space","word-break","overflow-wrap","text-overflow"]],
    ["color-background", ["color","background-color","background-image","background-size","background-position","background-repeat","background-origin","background-clip","background-blend-mode","fill","stroke","accent-color"]],
    ["effects", ["box-shadow","text-shadow","filter","backdrop-filter","mix-blend-mode","clip-path","mask-image","mask-size"]],
    ["transform-motion", ["transform","transform-origin","translate","rotate","scale","transition-property","transition-duration","transition-timing-function","transition-delay","animation-name","animation-duration","animation-timing-function","animation-delay","animation-iteration-count","animation-direction","animation-fill-mode"]],
  ];
  // Always emit these even if equal to the tag baseline — but suppress when
  // equal to the page's root/body value (because Document Context already says
  // so). These are typically inherited and AI consumers want concrete numbers.
  const STYLE_ALWAYS_VS_ROOT = new Set(["color","background-color","font-family","font-size","font-weight","line-height","display"]);
  // Physical/logical/webkit aliases — already covered by STYLE_GROUPS so we
  // skip them in the "other" sweep instead of double-printing.
  const STYLE_REDUNDANT = new Set([
    "block-size","inline-size","min-block-size","min-inline-size","max-block-size","max-inline-size",
    "border-block-start-color","border-block-end-color","border-inline-start-color","border-inline-end-color",
    "border-block-start-style","border-block-end-style","border-inline-start-style","border-inline-end-style",
    "border-block-start-width","border-block-end-width","border-inline-start-width","border-inline-end-width",
    "border-block-start","border-block-end","border-inline-start","border-inline-end",
    "border-start-start-radius","border-start-end-radius","border-end-start-radius","border-end-end-radius",
    "inset-block-start","inset-block-end","inset-inline-start","inset-inline-end","inset-block","inset-inline",
    "margin-block-start","margin-block-end","margin-inline-start","margin-inline-end","margin-block","margin-inline",
    "padding-block-start","padding-block-end","padding-inline-start","padding-inline-end","padding-block","padding-inline",
    "column-rule-color","column-rule-style","column-rule-width",
    "perspective-origin","overflow-clip-margin","text-emphasis-color",
    "scroll-margin","scroll-padding",
    "scroll-margin-block-start","scroll-margin-block-end","scroll-margin-inline-start","scroll-margin-inline-end",
    "scroll-padding-block-start","scroll-padding-block-end","scroll-padding-inline-start","scroll-padding-inline-end",
    "-webkit-text-fill-color","-webkit-text-stroke-color","-webkit-text-stroke-width",
    "-webkit-locale","-webkit-tap-highlight-color","-webkit-font-smoothing","-webkit-user-select",
    "-webkit-border-image","-webkit-rtl-ordering","-webkit-print-color-adjust",
    "text-rendering","caret-color",
  ]);

  const styleBaselineCache = new Map();
  let styleBaselineHost = null;
  let pageStyleSnapshotCache = null;
  let rootCssVarSnapshot = null;

  function ensureStyleBaselineHost() {
    if (styleBaselineHost && styleBaselineHost.isConnected) return styleBaselineHost;
    styleBaselineHost = document.createElement("div");
    styleBaselineHost.className = `${NS}-baseline-host`;
    styleBaselineHost.setAttribute("aria-hidden", "true");
    styleBaselineHost.style.cssText = "all:initial !important;position:absolute !important;left:-99999px !important;top:-99999px !important;width:0 !important;height:0 !important;overflow:hidden !important;visibility:hidden !important;pointer-events:none !important;contain:strict;";
    (document.body || document.documentElement).appendChild(styleBaselineHost);
    return styleBaselineHost;
  }

  function releaseStyleBaseline() {
    if (styleBaselineHost && styleBaselineHost.parentNode) styleBaselineHost.parentNode.removeChild(styleBaselineHost);
    styleBaselineHost = null;
    styleBaselineCache.clear();
    pageStyleSnapshotCache = null;
    rootCssVarSnapshot = null;
  }

  function getStyleBaseline(tagName) {
    const tag = String(tagName || "div").toLowerCase();
    if (styleBaselineCache.has(tag)) return styleBaselineCache.get(tag);
    let probe;
    try { probe = document.createElement(tag); }
    catch (_) { probe = document.createElement("div"); }
    const host = ensureStyleBaselineHost();
    host.appendChild(probe);
    const cs = getComputedStyle(probe);
    const snap = {};
    for (let i = 0; i < cs.length; i++) {
      const name = cs[i];
      snap[name] = cs.getPropertyValue(name);
    }
    host.removeChild(probe);
    styleBaselineCache.set(tag, snap);
    return snap;
  }

  // Page-level "what would I inherit if I didn't override anything" snapshot —
  // taken from body (or html) so we can drop element values that just match the
  // inherited root and are already covered by Document Context.
  function getPageStyleSnapshot() {
    if (pageStyleSnapshotCache) return pageStyleSnapshotCache;
    const source = document.body ? getComputedStyle(document.body) : getComputedStyle(document.documentElement);
    const snap = {};
    STYLE_ALWAYS_VS_ROOT.forEach(p => { snap[p] = (source.getPropertyValue(p) || "").trim(); });
    pageStyleSnapshotCache = snap;
    return snap;
  }

  function getRootCssVars() {
    if (rootCssVarSnapshot) return rootCssVarSnapshot;
    const cs = getComputedStyle(document.documentElement);
    const map = new Map();
    for (let i = 0; i < cs.length; i++) {
      const name = cs[i];
      if (name && name.startsWith("--")) map.set(name, cs.getPropertyValue(name).trim());
    }
    rootCssVarSnapshot = map;
    return map;
  }

  function hasAnyBorder(cs) {
    return ["border-top-width","border-right-width","border-bottom-width","border-left-width"]
      .some(p => parseFloat(cs.getPropertyValue(p)) > 0);
  }
  function hasAnyOutline(cs) {
    return parseFloat(cs.getPropertyValue("outline-width")) > 0;
  }
  function hasAnyRadius(cs) {
    return ["border-top-left-radius","border-top-right-radius","border-bottom-right-radius","border-bottom-left-radius"]
      .some(p => parseFloat(cs.getPropertyValue(p)) > 0);
  }

  function getComputedStyleReport(el) {
    const cs = getComputedStyle(el);
    const baseline = getStyleBaseline(el.tagName);
    const root = getPageStyleSnapshot();
    const noBorder = !hasAnyBorder(cs);
    const noOutline = !hasAnyOutline(cs);
    const noRadius = !hasAnyRadius(cs);
    const buckets = STYLE_GROUPS.map(([name]) => ({ name, rows: [] }));
    const seen = new Set();
    STYLE_GROUPS.forEach(([name, props], idx) => {
      props.forEach(prop => {
        seen.add(prop);
        // Collapse border/outline/radius when geometrically inert
        if (noBorder && /^border-(top|right|bottom|left)-(color|style)$/.test(prop)) return;
        if (noOutline && /^outline-(color|style|offset)$/.test(prop)) return;
        if (noRadius && /^border-(top-left|top-right|bottom-left|bottom-right)-radius$/.test(prop)) return;
        const value = cssValue(cs, prop);
        if (STYLE_ALWAYS_VS_ROOT.has(prop)) {
          if (value !== root[prop]) buckets[idx].rows.push(`  ${prop}: ${value}`);
          // else: equals page root → already in Document Context
        } else if (value !== (baseline[prop] || "")) {
          buckets[idx].rows.push(`  ${prop}: ${value}`);
        }
      });
    });
    const extra = [];
    for (let i = 0; i < cs.length; i++) {
      const prop = cs[i];
      if (!prop || seen.has(prop) || prop.startsWith("--")) continue;
      if (STYLE_REDUNDANT.has(prop)) continue;
      const value = cssValue(cs, prop);
      const base = baseline[prop];
      if (base !== undefined && value !== base) extra.push(`  ${prop}: ${value}`);
    }
    const sections = buckets.filter(b => b.rows.length).map(b => `${b.name}:\n${b.rows.join("\n")}`);
    if (extra.length) sections.push(`other:\n${extra.join("\n")}`);
    return sections.join("\n\n") || "matches page defaults";
  }

  const REPLICA_STYLE_MAX_GROUPS = 32;
  const REPLICA_STYLE_MAX_VARIANTS = 8;
  const REPLICA_STYLE_PROPS = [
    "display","position","top","right","bottom","left","z-index",
    "width","height","min-width","min-height","padding-top","padding-right","padding-bottom","padding-left",
    "margin-top","margin-right","margin-bottom","margin-left","overflow","overflow-x","overflow-y",
    "flex-direction","align-items","justify-content","gap","grid-template-columns","grid-template-rows",
    "font-family","font-size","font-weight","font-style","line-height","letter-spacing","text-align","text-transform","white-space",
    "color","background-color","background-image","fill","stroke","stroke-width","opacity",
    "border-top-width","border-right-width","border-bottom-width","border-left-width","border-top-color","border-right-color","border-bottom-color","border-left-color","border-radius",
    "box-shadow","text-shadow","filter","backdrop-filter","clip-path","mask-image",
    "transform","transform-origin","transition-property","transition-duration","transition-timing-function","transition-delay",
    "animation-name","animation-duration","animation-timing-function","animation-delay","animation-fill-mode","animation-play-state",
  ];

  function getReplicaStylePackReport(root, selected) {
    if (!root || !root.querySelectorAll) return "";
    const groups = collectReplicaStyleGroups(root, selected);
    if (!groups.length) return "";
    const rows = [
      `scope: ${describeElement(root)}`,
      `strategy: one computed-style sample per repeated selector signature; repeated instances are listed as variants`,
      "",
    ];
    groups.slice(0, REPLICA_STYLE_MAX_GROUPS).forEach((group, idx) => {
      rows.push(`[${idx + 1}] ${group.key}  (${group.items.length} instance${group.items.length > 1 ? "s" : ""})`);
      rows.push(`sample: ${describeElement(group.sample)} rect=${rectSize(group.sample)}${visibleSnippet(group.sample)}`);
      const variants = group.items.slice(0, REPLICA_STYLE_MAX_VARIANTS).map(item => `  - ${variantLine(item)}`);
      if (variants.length) rows.push("variants:", ...variants);
      if (group.items.length > REPLICA_STYLE_MAX_VARIANTS) {
        rows.push(`  - ${group.items.length - REPLICA_STYLE_MAX_VARIANTS} more similar variant${group.items.length - REPLICA_STYLE_MAX_VARIANTS > 1 ? "s" : ""} folded`);
      }
      const style = getReplicaStyleSubset(group.sample);
      if (style) rows.push("style:", style);
      rows.push("");
    });
    if (groups.length > REPLICA_STYLE_MAX_GROUPS) {
      rows.push(`${groups.length - REPLICA_STYLE_MAX_GROUPS} low-signal style group${groups.length - REPLICA_STYLE_MAX_GROUPS > 1 ? "s" : ""} not sampled; DOM Snapshot still contains them.`);
    }
    return rows.join("\n").trim();
  }

  function collectReplicaStyleGroups(root, selected) {
    const nodes = collectReplicaStyleNodes(root, selected);
    const map = new Map();
    nodes.forEach(node => {
      const key = replicaStyleKey(node);
      if (!key) return;
      if (!map.has(key)) map.set(key, { key, sample: node, items: [], score: 0 });
      const group = map.get(key);
      group.items.push(node);
      group.score = Math.max(group.score, replicaNodeScore(node, root, selected));
      if (replicaNodeScore(node, root, selected) > replicaNodeScore(group.sample, root, selected)) group.sample = node;
    });
    return Array.from(map.values()).sort((a, b) => b.score - a.score || b.items.length - a.items.length || a.key.localeCompare(b.key));
  }

  function collectReplicaStyleNodes(root, selected) {
    const out = [];
    const seen = new Set();
    const push = (node) => {
      if (!node || node.nodeType !== 1 || isEditorElement(node)) return;
      if (seen.has(node)) return;
      const r = safeRect(node);
      if (r.width <= 0 && r.height <= 0) return;
      seen.add(node);
      out.push(node);
    };
    push(root);
    push(selected);
    Array.from(root.children || []).forEach(push);
    Array.from(root.querySelectorAll("*")).forEach(node => {
      if (out.length > 650) return;
      if (!isReplicaStyleSampleCandidate(node, root, selected)) return;
      push(node);
    });
    return out;
  }

  function isReplicaStyleSampleCandidate(node, root, selected) {
    if (node === root || node === selected) return true;
    const tag = (node.tagName || "").toLowerCase();
    const cls = node.classList && node.classList.length;
    if (cls) return true;
    if (node.id || node.getAttribute("role") || node.getAttribute("data-node") || node.getAttribute("aria-label")) return true;
    return /^(svg|path|circle|rect|text|g|img|canvas|video|button|a|input|textarea|select)$/.test(tag);
  }

  function replicaStyleKey(node) {
    const tag = (node.tagName || "").toLowerCase();
    if (!tag) return "";
    const classes = Array.from(node.classList || []).filter(isStableClass).slice(0, 5);
    if (classes.length) return `${tag}.${classes.join(".")}`;
    if (node.id) return `${tag}#${node.id}`;
    const role = node.getAttribute && node.getAttribute("role");
    if (role) return `${tag}[role=${role}]`;
    const aria = node.getAttribute && node.getAttribute("aria-label");
    if (aria) return `${tag}[aria-label]`;
    return tag;
  }

  function replicaNodeScore(node, root, selected) {
    let score = 0;
    if (node === root) score += 1000;
    if (node === selected) score += 950;
    if (node.parentElement === root) score += 400;
    const r = safeRect(node);
    score += Math.min(240, Math.sqrt(Math.max(0, r.width * r.height)) / 2);
    const cls = Array.from(node.classList || []).join(" ");
    if (/active|selected|current|open|dark|featured|primary|hero|stage|label|card|actor|outcome|memory|slat|wave/i.test(cls)) score += 120;
    if (directText(node)) score += 40;
    return score;
  }

  function getReplicaStyleSubset(node) {
    const cs = getComputedStyle(node);
    const baseline = getStyleBaseline(node.tagName);
    const root = getPageStyleSnapshot();
    const rows = [];
    REPLICA_STYLE_PROPS.forEach(prop => {
      const value = cssValue(cs, prop);
      if (!value) return;
      if (prop === "background-color" && /rgba\(0,\s*0,\s*0,\s*0\)/.test(value)) return;
      if (prop === "background-image" && value === "none") return;
      if (prop === "border-radius" && value === "0px") return;
      if (/^border-(top|right|bottom|left)-width$/.test(prop) && parseFloat(value) === 0) return;
      if (/^border-(top|right|bottom|left)-color$/.test(prop) && !hasAnyBorder(cs)) return;
      if (prop.startsWith("animation-") && (cs.animationName === "none" || !cs.animationName)) return;
      if (prop.startsWith("transition-") && isZeroDurationList(cs.transitionDuration)) return;
      if (STYLE_ALWAYS_VS_ROOT.has(prop)) {
        if (value === root[prop]) return;
      } else if (value === (baseline[prop] || "")) {
        return;
      }
      rows.push(`  ${prop}: ${value}`);
    });
    return rows.join("\n");
  }

  function variantLine(node) {
    const data = ["data-node","data-step","data-state","aria-label","title"].map(name => {
      const value = node.getAttribute && node.getAttribute(name);
      return value ? `${name}="${truncate(value, 40)}"` : "";
    }).filter(Boolean).join(" ");
    return `${describeElement(node)} rect=${rectSize(node)}${data ? ` ${data}` : ""}${visibleSnippet(node)}`;
  }

  function rectSize(node) {
    const r = safeRect(node);
    return `${round2(r.width)}x${round2(r.height)}`;
  }

  function visibleSnippet(node) {
    const text = (node.innerText || directText(node) || "").replace(/\s+/g, " ").trim();
    return text ? ` text="${truncate(text, 70)}"` : "";
  }

  function isZeroDurationList(value) {
    return String(value || "").split(",").every(part => {
      const v = part.trim();
      return !v || v === "0s" || v === "0ms";
    });
  }

  // CSS Custom Properties — only emit variables that DIFFER from :root (or
  // aren't on :root at all). Document Context already prints every :root var,
  // so an element-level snapshot would otherwise re-emit ~all of them.
  function getCssVariablesReport(el) {
    const cs = getComputedStyle(el);
    const rootVars = getRootCssVars();
    const rows = [];
    // Origin resolution is bounded: the ancestor computed-style chain and the
    // custom-property rule index are built lazily on first use and only the
    // first CSS_VAR_ORIGIN_LIMIT variables get the (more expensive) lookup.
    let originBudget = CSS_VAR_ORIGIN_LIMIT;
    let chain = null;
    let ruleIndex = null;
    for (let i = 0; i < cs.length; i++) {
      const name = cs[i];
      if (!name || !name.startsWith("--")) continue;
      const value = cs.getPropertyValue(name).trim();
      if (rootVars.get(name) === value) continue;  // identical to :root → covered by Document Context
      let annotation = rootVars.has(name) ? " /* overrides :root */" : "";
      if (originBudget > 0) {
        originBudget--;
        if (chain === null) chain = buildComputedAncestorChain(el);
        if (ruleIndex === null) ruleIndex = buildCustomPropertyRuleIndex();
        const origin = describeCssVarOrigin(el, name, value, chain, ruleIndex);
        if (origin) annotation = ` /* ${origin}${rootVars.has(name) ? "; overrides :root" : ""} */`;
      }
      rows.push(`${name}: ${limitText(value, 1000, "value truncated")}${annotation}`);
      if (rows.length >= 120) {
        rows.push("... CSS variables truncated after 120 entries");
        break;
      }
    }
    return rows.join("\n");
  }

  // ── CSS custom-property origin ──────────────────────────────
  // "Where does this variable's value come from?" — the missing link between
  // Effective Style (values) and Matched Rules (rules). Two steps:
  //   1. walk up the ancestor chain: the highest node whose computed value
  //      still equals the element's is where the value enters the cascade;
  //   2. name the defining rule from a one-pass index of every stylesheet
  //      rule that sets custom properties (cross-origin sheets included via
  //      the host cache when available).
  const CSS_VAR_ORIGIN_LIMIT = 40;

  function buildComputedAncestorChain(el) {
    const chain = [];
    let node = el;
    let depth = 0;
    while (node && node.nodeType === 1 && depth++ < 60) {
      try { chain.push({ node, cs: getComputedStyle(node) }); } catch (_) {}
      node = node.parentElement;
    }
    return chain;
  }

  function buildCustomPropertyRuleIndex() {
    const index = new Map(); // property name → [{selector, source}]
    let total = 0;
    Array.from(document.styleSheets || []).forEach((sheet, sheetIdx) => {
      if (total >= 800) return;
      const rules = readableSheetRules(sheet, sheetIdx, null);
      if (!rules) return;
      const walk = (list) => {
        for (const rule of Array.from(list)) {
          if (total >= 800) return;
          if (rule.selectorText && rule.style) {
            for (let i = 0; i < rule.style.length; i++) {
              const prop = rule.style[i];
              if (!prop || !prop.startsWith("--")) continue;
              let entries = index.get(prop);
              if (!entries) { entries = []; index.set(prop, entries); }
              if (entries.length < 6) {
                entries.push({ selector: rule.selectorText, source: sheetLabel(sheet, sheetIdx) });
                total++;
              }
            }
          } else if (rule.cssRules) {
            // Skip conditional groups that do not currently apply — naming a
            // dormant @media rule as a variable's origin would be wrong.
            if (rule.media) {
              try { if (!matchMedia(rule.media.mediaText).matches) continue; } catch (_) {}
            }
            walk(rule.cssRules);
          }
        }
      };
      try { walk(rules); } catch (_) {}
    });
    return index;
  }

  function describeCssVarOrigin(el, name, value, chain, ruleIndex) {
    let definer = el;
    for (let i = 1; i < chain.length; i++) {
      let inherited = "";
      try { inherited = chain[i].cs.getPropertyValue(name).trim(); } catch (_) {}
      if (inherited === value) definer = chain[i].node;
      else break;
    }
    try {
      if (definer.style && definer.style.getPropertyValue(name).trim()) {
        return `set inline on ${describeElement(definer)}`;
      }
    } catch (_) {}
    // Later rules win at equal specificity, so probe in reverse source order.
    const entries = (ruleIndex.get(name) || []).slice().reverse();
    for (const entry of entries) {
      for (const part of splitSelector(entry.selector)) {
        try {
          if (definer.matches(part)) {
            const where = definer === el ? "" : ` on ${describeElement(definer)}`;
            return `set by \`${entry.selector}\` (${entry.source})${where}`;
          }
        } catch (_) {}
      }
    }
    if (definer !== el) return `inherited from ${describeElement(definer)}`;
    return "";
  }

  // Three flavors of matched-rule extraction share one walker. Modes:
  //   normal: selector matches the element as-is (no pseudo-class hypotheticals)
  //   interactive: selector contains a pseudo-class like :hover/:focus/:active/:checked/:disabled
  //                and matches after stripping that pseudo-class
  //   color-scheme: rule is wrapped in @media (prefers-color-scheme: ...) and matches normally
  const INTERACTIVE_PSEUDO = [":hover",":focus-visible",":focus-within",":focus",":active",":disabled",":checked",":indeterminate",":required",":invalid",":valid",":placeholder-shown",":target",":visited"];

  // Matched rules carry an origin tag:
  //   "self"             — rule.matches(el) directly
  //   "descendant"       — rule matches a child of el (probed via el.querySelector)
  //   "self+descendant"  — both
  // Universal/global selectors ("*", "body", "html", ":root") only do self
  // probing — Document Context already covers their effect, descendant scope
  // would just inflate noise. Functional pseudos (:has/:is/:where/:not) skip
  // descendant probing because querySelector's absolute matching diverges
  // from the CSS engine's relative matching for those.
  const SELECTOR_GLOBAL = new Set(["*","html","body",":root","html *","body *"]);
  const SELECTOR_FUNCTIONAL_PSEUDO = /:(has|is|where|not)\s*\(/i;

  function buildDescendantHints(el) {
    // Cheap pre-filter: collect every className/tagName/id token used anywhere
    // in the element subtree. If a selector contains none of them, we can skip
    // the querySelector probe entirely.
    const tokens = new Set();
    const visit = (node) => {
      if (!node || node.nodeType !== 1) return;
      if (isEditorElement(node)) return;
      tokens.add(node.tagName.toLowerCase());
      if (node.id) tokens.add(`#${node.id}`);
      const cls = node.classList;
      if (cls && cls.length) for (let i = 0; i < cls.length; i++) tokens.add(`.${cls[i]}`);
    };
    visit(el);
    if (el.querySelectorAll) {
      Array.from(el.querySelectorAll("*")).forEach(visit);
    }
    return tokens;
  }

  function selectorTouchesDescendants(selectorText, hints) {
    // Conservative: if any token in the selector matches a descendant hint,
    // it's worth probing. If selector is just "*"/tag-only universal, skip.
    if (SELECTOR_GLOBAL.has(selectorText.trim())) return false;
    for (const token of hints) {
      // crude substring match — fine for filtering, not authoritative
      if (selectorText.indexOf(token) !== -1) return true;
    }
    return false;
  }

  // ── Host stylesheet seam (HOST_CONTRACT.md §11) ──────
  // Cross-origin stylesheets throw on .cssRules access. The extension
  // pre-warms a cache (copyPrompt → HOST.prepareStyles) that fetches the
  // raw text and parses it into a CSSStyleSheet; here we read the parsed
  // rules synchronously and walk them like any same-origin sheet. Miss →
  // null (bookmarklet), optionally recorded in the caller's inaccessible list.
  function readableSheetRules(sheet, index, inaccessible) {
    try { return sheet.cssRules; }
    catch (_) {
      if (HOST.cachedStylesheetRules) {
        try {
          const hostedRules = HOST.cachedStylesheetRules(sheet.href);
          if (hostedRules) return hostedRules;
        } catch (_) { /* fall through */ }
      }
      if (inaccessible) inaccessible.push(sheet.href || `stylesheet #${index + 1}`);
      return null;
    }
  }

  function getMatchedCssRulesReport(el) {
    const state = makeRuleState({ maxRows: 400, maxChars: 90000 });
    const hints = buildDescendantHints(el);
    const inaccessible = [];
    Array.from(document.styleSheets || []).forEach((sheet, index) => {
      const rules = readableSheetRules(sheet, index, inaccessible);
      if (!rules) return;
      walkCssRules(el, rules, sheetLabel(sheet, index), [], state, "normal", hints);
    });
    const rows = state.rows.slice();
    if (inaccessible.length) {
      rows.push("", "/* Inaccessible stylesheets (cross-origin CSS, cannot read text): */");
      inaccessible.slice(0, 20).forEach(item => rows.push(`/* - ${item} */`));
      if (inaccessible.length > 20) rows.push(`/* ... ${inaccessible.length - 20} more */`);
    }
    if (state.truncated) rows.push("", "/* Matched rules truncated to keep the report responsive. Effective Style above remains authoritative. */");
    if (!state.rows.length && !inaccessible.length) return "";
    return rows.join("\n");
  }

  function getInteractiveStatesReport(el) {
    const state = makeRuleState({ maxRows: 200, maxChars: 50000 });
    const hints = buildDescendantHints(el);
    Array.from(document.styleSheets || []).forEach((sheet, index) => {
      const rules = readableSheetRules(sheet, index, null);
      if (!rules) return;
      walkCssRules(el, rules, sheetLabel(sheet, index), [], state, "interactive", hints);
    });
    if (state.truncated) state.rows.push("", "/* Interactive rules truncated. */");
    return state.rows.length ? state.rows.join("\n") : "";
  }

  // Ancestor Chain — for an absolutely-positioned / transform-scaled child,
  // the containing-block ancestors decide *where* and *how* it actually renders.
  // We walk up from el.parentElement keeping every "worth-keeping" ancestor
  // (positioned, transformed, scrolling, semantic landmark, id-bearing,
  // flex/grid, or clip/mask container) plus body.
  // Each kept ancestor gets a tight style subset (transform / containing-block
  // properties / background / clip) and its matched CSS rules — but only the
  // rules that haven't already been emitted in the element's own Matched
  // Rules section above, so we never double-print global rules like `* {}`.
  const ANCESTOR_STYLE_PROPS = [
    "display","position","top","right","bottom","left","z-index",
    "width","height",
    "padding-top","padding-right","padding-bottom","padding-left",
    "margin-top","margin-right","margin-bottom","margin-left",
    "overflow","overflow-x","overflow-y",
    "transform","transform-origin","scale","translate","rotate","perspective","perspective-origin",
    "container-type","container-name","contain","isolation",
    "background-color","background-image","clip-path","mask-image","filter","backdrop-filter",
    "box-shadow","border-radius",
    "border-top-width","border-right-width","border-bottom-width","border-left-width",
    "flex-direction","align-items","justify-content","gap","grid-template-columns","grid-template-rows",
  ];
  const ANCESTOR_SEMANTIC_TAGS = new Set([
    "section","main","article","aside","nav","header","footer","form","dialog","figure","svg",
  ]);
  const ANCESTOR_RULES_CHAR_CAP = 6000;

  function isAncestorWorthKeeping(node) {
    let cs;
    try { cs = getComputedStyle(node); } catch (_) { return false; }
    if (cs.position !== "static") return true;
    if (cs.transform && cs.transform !== "none") return true;
    if (cs.perspective && cs.perspective !== "none") return true;
    if (cs.filter && cs.filter !== "none") return true;
    if (cs.contain && cs.contain !== "none" && cs.contain !== "normal") return true;
    if (cs.overflow && cs.overflow !== "visible") return true;
    if (/flex|grid/.test(cs.display)) return true;
    if (cs.clipPath && cs.clipPath !== "none") return true;
    if (cs.maskImage && cs.maskImage !== "none") return true;
    if (cs.backgroundImage && cs.backgroundImage !== "none") return true;
    if (node.id) return true;
    if (ANCESTOR_SEMANTIC_TAGS.has((node.tagName || "").toLowerCase())) return true;
    return false;
  }

  function collectAncestorChain(el) {
    const chain = [];
    const immediate = el.parentElement;
    let node = immediate;
    let depth = 0;
    while (node && node !== document.documentElement && depth++ < 40) {
      if (isEditorElement(node)) { node = node.parentElement; continue; }
      const keep = (node === immediate) || (node === document.body) || isAncestorWorthKeeping(node);
      if (keep) chain.push(node);
      if (node === document.body) break;
      node = node.parentElement;
    }
    return chain;
  }

  function getAncestorStyleSubset(node) {
    const cs = getComputedStyle(node);
    const baseline = getStyleBaseline(node.tagName);
    const rows = [];
    ANCESTOR_STYLE_PROPS.forEach(prop => {
      const v = cssValue(cs, prop);
      if (!v) return;
      if (v === (baseline[prop] || "")) return;
      if (prop === "background-color" && /rgba\(0,\s*0,\s*0,\s*0\)/.test(v)) return;
      if (prop === "background-image" && v === "none") return;
      if (prop === "border-radius" && v === "0px") return;
      if (/^border-(top|right|bottom|left)-width$/.test(prop) && parseFloat(v) === 0) return;
      rows.push(`  ${prop}: ${v}`);
    });
    return rows.join("\n");
  }

  function getAncestorMatchedRules(node) {
    const ownTokens = (typeof stableClasses === "function" ? stableClasses(node) : []);
    if (!ownTokens.length && !node.id) return "";
    const state = makeRuleState({ maxRows: 60, maxChars: ANCESTOR_RULES_CHAR_CAP });
    state.dedupCheck = true;
    Array.from(document.styleSheets || []).forEach((sheet, idx) => {
      const rules = readableSheetRules(sheet, idx, null);
      if (!rules) return;
      walkCssRules(node, rules, sheetLabel(sheet, idx), [], state, "normal", null);
    });
    return state.rows.join("\n");
  }

  function getAncestorChainReport(el) {
    const chain = collectAncestorChain(el);
    if (!chain.length) return "";
    const blocks = [];
    chain.forEach((entry, i) => {
      const node = entry;
      const annotation = (i === 0) ? "  (immediate parent — also visible in Parent Snapshot open tag)" : "";
      const head = `[${i + 1}] ${describeElement(node)}${annotation}`;
      const style = getAncestorStyleSubset(node);
      const rules = getAncestorMatchedRules(node);
      const parts = [head];
      if (style) parts.push("style:\n" + style);
      if (rules) parts.push("rules (not already in Matched Rules above):\n" + rules);
      const block = parts.join("\n");
      blocks.push(block);
    });
    return blocks.join("\n\n");
  }

  function getColorSchemeRulesReport(el) {
    const state = makeRuleState({ maxRows: 120, maxChars: 30000 });
    const hints = buildDescendantHints(el);
    Array.from(document.styleSheets || []).forEach((sheet, index) => {
      const rules = readableSheetRules(sheet, index, null);
      if (!rules) return;
      walkCssRules(el, rules, sheetLabel(sheet, index), [], state, "color-scheme", hints);
    });
    if (state.truncated) state.rows.push("", "/* Color-scheme rules truncated. */");
    return state.rows.length ? state.rows.join("\n") : "";
  }

  function makeRuleState(opts) {
    return { rows: [], chars: 0, truncated: false, maxRows: opts.maxRows, maxChars: opts.maxChars };
  }

  // Per-element dedup signal: every (source, selectorText) pair emitted during
  // the element's own Matched/Interactive/Color-scheme walks gets recorded.
  // The Ancestor Chain rule walk (state.dedupCheck === true) consults this set
  // and skips re-emitting the same rule against an ancestor — that rule
  // already appeared above; what we want from ancestors is what's net-new.
  let perElementEmittedRules = null;

  function walkCssRules(el, rules, source, wrappers, state, mode, hints) {
    if (!rules || state.truncated) return;
    for (const rule of Array.from(rules)) {
      if (state.truncated) break;
      if (rule.selectorText && rule.style) {
        const match = ruleMatchesForMode(el, rule.selectorText, mode, hints);
        if (!match) continue;
        if (mode === "color-scheme" && !wrappersContainColorScheme(wrappers)) continue;
        const dedupKey = `${source}::${rule.selectorText}`;
        if (state.dedupCheck && perElementEmittedRules && perElementEmittedRules.has(dedupKey)) continue;
        let text = compactCssRule(rule.cssText || "");
        // Origin tag: self-only is the default, only annotate descendant hits.
        if (match.origin === "descendant") {
          const where = match.descendantEl ? describeElement(match.descendantEl) : "child";
          const approx = match.approx ? " (approx — selector uses :has/:is/:where/:not)" : "";
          text = `/* matches: descendant — first hit: ${where}${approx} */\n${text}`;
        } else if (match.origin === "self+descendant") {
          const where = match.descendantEl ? describeElement(match.descendantEl) : "child";
          text = `/* matches: self + descendant ${where} */\n${text}`;
        }
        if (mode === "interactive" && match.matchedPart && match.matchedPart !== rule.selectorText) {
          text = `/* matches via ${match.matchedPart} */\n${text}`;
        }
        if (wrappers.length) text = `${wrappers.join(" ")} { ${text} }`;
        text = `/* ${source} */\n${text}`;
        if (state.chars + text.length > state.maxChars || state.rows.length >= state.maxRows) {
          state.truncated = true;
          break;
        }
        state.rows.push(text);
        state.chars += text.length;
        if (perElementEmittedRules) perElementEmittedRules.add(dedupKey);
        continue;
      }
      if (rule.cssRules) {
        const label = groupRuleLabel(rule);
        walkCssRules(el, rule.cssRules, source, label ? [...wrappers, label] : wrappers, state, mode, hints);
      }
    }
  }

  function ruleMatchesForMode(el, selectorText, mode, hints) {
    const parts = splitSelector(selectorText);
    const result = { origin: null, matchedPart: null, descendantEl: null, approx: false };

    const probeDescendant = (probeSelector, partForReport) => {
      if (result.origin === "self+descendant" || result.descendantEl) return;
      if (!probeSelector || probeSelector === "*") return;
      if (SELECTOR_GLOBAL.has(probeSelector.trim())) return;
      if (hints && !selectorTouchesDescendants(probeSelector, hints)) return;
      const approx = SELECTOR_FUNCTIONAL_PSEUDO.test(probeSelector);
      try {
        const hit = el.querySelector(probeSelector);
        if (hit && hit !== el) {
          result.descendantEl = hit;
          result.matchedPart = result.matchedPart || partForReport;
          result.approx = approx;
        }
      } catch (_) {}
    };

    if (mode === "interactive") {
      for (const part of parts) {
        if (!hasInteractivePseudo(part)) continue;
        const stripped = stripInteractivePseudo(part);
        if (!stripped) continue;
        try { if (el.matches(stripped)) { result.origin = "self"; result.matchedPart = part; break; } } catch (_) {}
      }
      // even if self matched, also probe descendants — gives full picture
      for (const part of parts) {
        if (!hasInteractivePseudo(part)) continue;
        const stripped = stripInteractivePseudo(part);
        probeDescendant(stripped, part);
      }
    } else {
      // normal / color-scheme: self probe first
      for (const part of parts) {
        if (mode === "normal" && hasInteractivePseudo(part)) continue;
        try { if (el.matches(part)) { result.origin = "self"; result.matchedPart = part; break; } } catch (_) {}
        const cleanedPart = part.replace(/::[a-z-]+(\([^)]*\))?$/i, "");
        if (cleanedPart && cleanedPart !== part) {
          try { if (el.matches(cleanedPart)) { result.origin = "self"; result.matchedPart = part; break; } } catch (_) {}
        }
      }
      // descendant probe
      for (const part of parts) {
        if (mode === "normal" && hasInteractivePseudo(part)) continue;
        const cleaned = part.replace(/::[a-z-]+(\([^)]*\))?$/i, "") || part;
        probeDescendant(cleaned, part);
      }
    }

    if (result.descendantEl && result.origin === "self") result.origin = "self+descendant";
    else if (result.descendantEl && !result.origin) result.origin = "descendant";
    if (!result.origin) return null;
    return result;
  }

  function splitSelector(selectorText) {
    return String(selectorText || "").split(",").map(p => p.trim()).filter(Boolean);
  }

  function hasInteractivePseudo(selector) {
    return INTERACTIVE_PSEUDO.some(p => new RegExp(p + "(?![\\w-])").test(selector));
  }

  function stripInteractivePseudo(selector) {
    let out = selector;
    INTERACTIVE_PSEUDO.forEach(p => {
      out = out.replace(new RegExp(p.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") + "(\\([^)]*\\))?", "g"), "");
    });
    out = out.replace(/\s+/g, " ").trim();
    return out || "*";
  }

  function wrappersContainColorScheme(wrappers) {
    return wrappers.some(w => /prefers-color-scheme/i.test(w));
  }

  function sheetLabel(sheet, index) {
    if (sheet.href) {
      try {
        const url = new URL(sheet.href, location.href);
        return url.pathname.split("/").pop() || url.href;
      } catch(_) {
        return sheet.href;
      }
    }
    const owner = sheet.ownerNode;
    if (owner && owner.id) return `style#${owner.id}`;
    return `inline style #${index + 1}`;
  }

  function groupRuleLabel(rule) {
    if (rule.conditionText) return `@media/supports ${rule.conditionText}`;
    if (rule.name) return `@${rule.name}`;
    const text = String(rule.cssText || "").split("{")[0].trim();
    return text && text.startsWith("@") ? text : "";
  }

  function compactCssRule(text) {
    return limitText(String(text || "").replace(/\s+/g, " ").trim(), 1600, "rule truncated");
  }

  // Pseudo-elements: only emit when ::before/::after actually renders something
  // (content != none/normal), and only the properties that diverge from the
  // pseudo-element baseline. Skipping noise like `transform: none`.
  const PSEUDO_PROPS = ["content","display","position","top","right","bottom","left","width","height","margin","padding","color","background-color","background-image","background-size","background-position","border","border-radius","box-shadow","transform","transform-origin","opacity","z-index","font-family","font-size","font-weight","line-height","text-align"];

  function getPseudoElementsReport(el) {
    const parts = [pseudoElementReport(el, "::before"), pseudoElementReport(el, "::after")].filter(Boolean);
    return parts.join("\n\n");
  }

  function pseudoElementReport(el, pseudo) {
    let cs;
    try { cs = getComputedStyle(el, pseudo); }
    catch(_) { return ""; }
    const content = cs.getPropertyValue("content");
    if (!content || content === "none" || content === "normal") return "";
    const baseline = getStyleBaseline(el.tagName);
    const rows = [];
    PSEUDO_PROPS.forEach(prop => {
      const value = cssValue(cs, prop);
      if (prop === "content" || value !== (baseline[prop] || "")) rows.push(`  ${prop}: ${value}`);
    });
    return `${pseudo}:\n${rows.join("\n")}`;
  }

  // Text-content diff — outerHTML already carries the full text. Only worth
  // emitting when innerText (what users see) diverges from textContent (raw
  // DOM text including hidden/display:none nodes).
  function getTextContentDiffReport(el) {
    const inner = (el.innerText || "").replace(/\s+/g, " ").trim();
    const raw = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!inner && !raw) return "";
    if (inner === raw) return "";
    return `innerText (visible):\n${limitText(inner, 8000, "innerText truncated") || "(empty)"}\n\ntextContent (raw):\n${limitText(raw, 8000, "textContent truncated") || "(empty)"}`;
  }

  // Children outline is redundant when the DOM Snapshot wasn't truncated —
  // the full HTML already shows the tree. Only surface a structural summary
  // (with rendered sizes — info HTML doesn't carry) when the snapshot was cut
  // or when the tree is deep enough that a compact map helps the consumer.
  function getChildrenOutlineReport(el) {
    const children = Array.from(el.children || []).filter(c => !isEditorElement(c));
    if (!children.length) return "";
    const totalDescendants = el.querySelectorAll ? el.querySelectorAll("*").length : children.length;
    if (!sharinganDomTruncated && totalDescendants < 60) return "";
    const state = { count: 0, truncated: false, max: 240 };
    const rows = [];
    children.forEach(child => appendChildStructure(child, 0, rows, state));
    if (state.truncated) rows.push(`... children outline truncated after ${state.max} nodes`);
    return rows.join("\n");
  }

  function appendChildStructure(el, depth, rows, state) {
    if (state.count >= state.max) { state.truncated = true; return; }
    if (isEditorElement(el)) return;
    state.count++;
    const indent = "  ".repeat(depth);
    const r = el.getBoundingClientRect();
    rows.push(`${indent}${describeElement(el)} rect=${round2(r.width)}x${round2(r.height)}`);
    if (depth >= 4) {
      if (el.children.length) rows.push(`${indent}  ... ${el.children.length} deeper children`);
      return;
    }
    Array.from(el.children || []).forEach(child => appendChildStructure(child, depth + 1, rows, state));
  }

  // Media assets — only fields outerHTML does NOT already carry:
  // currentSrc resolution, intrinsic dimensions, video sizing, and CSS
  // background images (which never appear in HTML).
  function getMediaAssetsReport(el) {
    const rows = [];
    const nodes = [el, ...Array.from(el.querySelectorAll ? el.querySelectorAll("img,video,source,iframe,canvas") : [])]
      .filter((node, index, all) => all.indexOf(node) === index)
      .slice(0, 40);
    nodes.forEach(node => {
      const line = mediaNodeReport(node);
      if (line) rows.push(line);
    });
    const bgs = collectBackgroundImages(el);
    bgs.forEach(bg => rows.push(`background-image @ ${bg.selector}: ${limitText(bg.value, 2000, "background-image truncated")}`));
    return rows.join("\n");
  }

  function mediaNodeReport(node) {
    const tag = (node.tagName || "").toLowerCase();
    if (tag === "img") {
      const src = node.getAttribute("src") || "";
      const current = node.currentSrc || "";
      const dims = `${node.naturalWidth || 0}x${node.naturalHeight || 0}`;
      if (current && current !== src) return `${describeElement(node)} currentSrc="${current}" natural=${dims}`;
      if (dims !== "0x0") return `${describeElement(node)} natural=${dims}`;
      return "";
    }
    if (tag === "video") {
      const dims = `${node.videoWidth || 0}x${node.videoHeight || 0}`;
      const src = node.currentSrc || node.getAttribute("src") || "";
      if (!src && dims === "0x0") return "";
      return `${describeElement(node)} currentSrc="${src}" video=${dims}`;
    }
    if (tag === "source") {
      const src = node.getAttribute("src") || node.getAttribute("srcset") || "";
      const type = node.getAttribute("type") || "";
      if (!src && !type) return "";
      return `${describeElement(node)} src="${src}" type="${type}"`;
    }
    if (tag === "iframe") {
      const r = node.getBoundingClientRect();
      let crossOrigin = false;
      try { void node.contentDocument; } catch (_) { crossOrigin = true; }
      return `${describeElement(node)} src="${node.getAttribute("src") || ""}" rendered=${round2(r.width)}x${round2(r.height)}${crossOrigin ? " crossOrigin=true" : ""}`;
    }
    if (tag === "canvas") {
      const ctx = (() => { try { return node.getContext && node.getContext("2d") ? "2d" : (node.getContext && node.getContext("webgl") ? "webgl" : "unknown"); } catch(_) { return "unknown"; } })();
      let snapshot = "";
      try { if (node.width <= 320 && node.height <= 320) snapshot = ` snapshot="${limitText(node.toDataURL(), 5000, "dataURL truncated")}"`; }
      catch(_) {}
      return `${describeElement(node)} bitmap=${node.width || 0}x${node.height || 0} context=${ctx}${snapshot}`;
    }
    return "";
  }

  function collectBackgroundImages(root) {
    const out = [];
    const seenSelectors = new Set();
    const pushIf = (node, label) => {
      const value = (getComputedStyle(node).backgroundImage || "").trim();
      if (!value || value === "none") return;
      if (seenSelectors.has(label)) return;
      seenSelectors.add(label);
      out.push({ selector: label, value });
    };
    pushIf(root, "self");
    if (root.querySelectorAll) {
      Array.from(root.querySelectorAll("*")).slice(0, 50).forEach((node, i) => {
        if (isEditorElement(node)) return;
        pushIf(node, describeElement(node));
        if (out.length >= 20) return;
      });
    }
    return out.slice(0, 20);
  }

  // SVG sprite — when icons are rendered via <use href="#icon-x">, the symbol
  // definition lives elsewhere in the document. Without inlining it the receiving
  // AI sees an empty <use> and can't reproduce the icon.
  function getSvgSpriteReport(el) {
    if (!el.querySelectorAll) return "";
    const uses = Array.from(el.querySelectorAll("use"));
    if (!uses.length) return "";
    const seen = new Set();
    const blocks = [];
    uses.forEach(use => {
      const raw = use.getAttribute("href") || use.getAttribute("xlink:href") || "";
      if (!raw || !raw.startsWith("#")) return;
      const id = raw.slice(1);
      if (seen.has(id)) return;
      seen.add(id);
      const target = document.getElementById(id);
      if (!target) {
        blocks.push(`<!-- #${id} referenced via <use> but not found in document -->`);
        return;
      }
      const symClone = target.cloneNode(true);
      sanitizeReportClone(symClone);
      const inlines = buildImageInlineMap(target);
      applyImageInlineMap(target, symClone, inlines);
      blocks.push(`<!-- #${id} -->\n${limitText(symClone.outerHTML || "", 12000, "symbol truncated")}`);
      if (blocks.length >= 12) return;
    });
    return blocks.join("\n\n");
  }

  function getFontUsageReport(root, selected) {
    if (!root) return "";
    const nodes = collectReplicaStyleNodes(root, selected).slice(0, 320);
    const groups = new Map();
    nodes.forEach(node => {
      const cs = getComputedStyle(node);
      const key = [
        compactCssValue(cs.fontFamily),
        cs.fontStyle,
        cs.fontWeight,
        cs.fontSize,
        cs.lineHeight,
        cs.letterSpacing,
      ].join(" | ");
      if (!groups.has(key)) groups.set(key, { key, sample: node, items: [] });
      groups.get(key).items.push(node);
    });
    const rows = [];
    Array.from(groups.values())
      .sort((a, b) => b.items.length - a.items.length)
      .slice(0, 18)
      .forEach((group, i) => {
        const [family, style, weight, size, lineHeight, letterSpacing] = group.key.split(" | ");
        rows.push(`[${i + 1}] ${family}`);
        rows.push(`  style=${style} weight=${weight} size=${size} line-height=${lineHeight} letter-spacing=${letterSpacing}`);
        rows.push(`  sample: ${describeElement(group.sample)}${visibleSnippet(group.sample)}`);
        if (group.items.length > 1) rows.push(`  used by ${group.items.length} sampled node${group.items.length > 1 ? "s" : ""}`);
      });
    return rows.join("\n");
  }

  function getAnimationRuntimeReport(root, selected) {
    if (!root) return "";
    const rows = [];
    const stateRows = collectActiveStateRows(root, selected);
    if (stateRows.length) rows.push("[active/runtime state]", ...stateRows);

    const cssRows = collectCssAnimationRows(root, selected);
    if (cssRows.length) {
      if (rows.length) rows.push("");
      rows.push("[css animations/transitions]", ...cssRows);
    }

    const svgRows = collectSvgAnimationRows(root);
    if (svgRows.length) {
      if (rows.length) rows.push("");
      rows.push("[svg animation elements]", ...svgRows);
    }
    return rows.join("\n");
  }

  function collectActiveStateRows(root, selected) {
    const rows = [];
    const attrs = ["data-step","data-state","aria-expanded","aria-selected","aria-current","open"];
    [root, selected].forEach(node => {
      if (!node || node.nodeType !== 1) return;
      const found = attrs.map(name => {
        if (name === "open") return node.hasAttribute && node.hasAttribute("open") ? "open=true" : "";
        const value = node.getAttribute && node.getAttribute(name);
        return value ? `${name}="${truncate(value, 80)}"` : "";
      }).filter(Boolean);
      if (found.length) rows.push(`${node === root ? "root" : "selected"} ${describeElement(node)} ${found.join(" ")}`);
    });
    const active = Array.from(root.querySelectorAll ? root.querySelectorAll(".is-active,.active,[aria-selected='true'],[aria-current]") : [])
      .filter(node => !isEditorElement(node))
      .slice(0, 40);
    active.forEach(node => rows.push(`${describeElement(node)} rect=${rectSize(node)}${visibleSnippet(node)}`));
    return rows;
  }

  function collectCssAnimationRows(root, selected) {
    const nodes = collectReplicaStyleNodes(root, selected).slice(0, 420);
    const rows = [];
    const seen = new Set();
    nodes.forEach(node => {
      const cs = getComputedStyle(node);
      const hasAnimation = cs.animationName && cs.animationName !== "none";
      const hasTransition = !isZeroDurationList(cs.transitionDuration);
      if (!hasAnimation && !hasTransition) return;
      const key = [
        replicaStyleKey(node),
        cs.animationName,
        cs.animationDuration,
        cs.animationDelay,
        cs.transitionProperty,
        cs.transitionDuration,
        cs.transitionDelay,
      ].join("|");
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(`${describeElement(node)} rect=${rectSize(node)}`);
      if (hasAnimation) {
        rows.push(`  animation-name=${cs.animationName}; duration=${cs.animationDuration}; delay=${cs.animationDelay}; easing=${cs.animationTimingFunction}; iteration=${cs.animationIterationCount}; fill=${cs.animationFillMode}; play-state=${cs.animationPlayState}`);
      }
      if (hasTransition) {
        rows.push(`  transition-property=${cs.transitionProperty}; duration=${cs.transitionDuration}; delay=${cs.transitionDelay}; easing=${cs.transitionTimingFunction}`);
      }
      if (rows.length >= 80) rows.push("  additional animation rows folded by repeated signature");
    });
    return rows.slice(0, 80);
  }

  function collectSvgAnimationRows(root) {
    const nodes = Array.from(root.querySelectorAll ? root.querySelectorAll("animate,animateMotion,animateTransform,set") : []).slice(0, 40);
    return nodes.map(node => {
      const owner = node.parentElement ? describeElement(node.parentElement) : "";
      const attrs = ["attributeName","dur","begin","fill","repeatCount","path","from","to","values","keyTimes","keySplines"]
        .map(name => {
          const value = node.getAttribute(name);
          return value ? `${name}="${truncate(value, 220)}"` : "";
        })
        .filter(Boolean)
        .join(" ");
      return `${describeElement(node)} in ${owner}${attrs ? ` ${attrs}` : ""}`;
    });
  }

  // @font-face — pull rules for font families actually referenced by the
  // element or its descendants. Without these the receiving AI can't load
  // the correct custom fonts.
  function getFontFacesReport(el) {
    const families = new Set();
    collectUsedFontFamiliesInto(el, families);
    // Ancestors often carry font-family declarations that apply to siblings
    // visible in Parent Snapshot (e.g. .macf-line-label inherits from the
    // ancestor section). Without scanning their subtrees we miss the fonts
    // those rules use.
    expandScopeToAncestors(el).forEach(node => collectUsedFontFamiliesInto(node, families));
    if (!families.size) return "";
    const rows = [];
    const seen = new Set();
    Array.from(document.styleSheets || []).forEach((sheet, index) => {
      let rules;
      try { rules = sheet.cssRules; }
      catch (_) {
        // Cross-origin: reuse the §11 pre-warmed parsed rules if available so we
        // can still surface (and inline) @font-face declarations from that sheet.
        if (HOST.cachedStylesheetRules) {
          try { rules = HOST.cachedStylesheetRules(sheet.href); }
          catch (_) { rules = null; }
        }
        if (!rules) return;
      }
      collectFontFaceRules(rules, sheetLabel(sheet, index), families, rows, seen);
    });
    const loaded = describeLoadedFontFaces(families);
    if (loaded) rows.push(loaded);
    return rows.join("\n\n");
  }

  // Walk up to the body, returning the subset of ancestors we want to
  // *also* scan for keyframe/font-family references. Reuses the same
  // worth-keeping heuristic as the Ancestor Chain section so the two
  // sections agree on which ancestors are load-bearing.
  function expandScopeToAncestors(el) {
    const out = [];
    let node = el.parentElement;
    let depth = 0;
    while (node && node !== document.documentElement && depth++ < 40) {
      if (isEditorElement(node)) { node = node.parentElement; continue; }
      out.push(node);
      if (node === document.body) break;
      node = node.parentElement;
    }
    return out;
  }

  // ── Host font seam (HOST_CONTRACT.md §11) ──────────────────
  // When the extension has pre-warmed a font binary (copyPrompt → prepareStyles
  // → HOST.cachedFontDataURL), rewrite the @font-face `src: url(...)` to the
  // cached dataURL so the receiving AI gets the actual font, not a dead URL.
  // Bookmarklet has no HOST.cachedFontDataURL → returns rule.cssText unchanged.
  function inlineFontFaceSrc(rule, source) {
    const cssText = rule.cssText || "";
    if (!HOST.cachedFontDataURL) return cssText;
    // Resolve relative url()s against the owning stylesheet href (the source
    // label is the sheet href when cross-origin), falling back to document base.
    let baseHref = document.baseURI;
    try {
      const sheetHref = rule.parentStyleSheet && rule.parentStyleSheet.href;
      if (sheetHref) baseHref = sheetHref;
      else if (source && /^https?:/i.test(source)) baseHref = source;
    } catch (_) {}
    return cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, quote, raw) => {
      const target = (raw || "").trim();
      if (!target || target.indexOf("data:") === 0) return whole;
      let abs = target;
      try { abs = new URL(target, baseHref).href; } catch (_) {}
      let hosted = null;
      try { hosted = HOST.cachedFontDataURL(abs); }
      catch (_) { hosted = null; }
      if (hosted && typeof hosted === "string" && hosted.indexOf("data:") === 0) {
        return `url("${hosted}")`;
      }
      return whole;
    });
  }

  function collectFontFaceRules(rules, source, families, rows, seen) {
    if (!rules) return;
    for (const rule of Array.from(rules)) {
      if (rule.type === 5 /* FONT_FACE_RULE */ && rule.style) {
        const family = String(rule.style.getPropertyValue("font-family") || "").replace(/["']/g, "").trim().toLowerCase();
        if (!family) continue;
        if (![...families].some(f => f === family || family.split(",").some(part => part.trim() === f))) continue;
        const key = `${source}::${rule.cssText}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(`/* ${source} */\n${compactCssRule(inlineFontFaceSrc(rule, source))}`);
      } else if (rule.cssRules) {
        collectFontFaceRules(rule.cssRules, source, families, rows, seen);
      }
    }
  }

  function collectUsedFontFamiliesInto(root, out) {
    if (!root || root.nodeType !== 1) return;
    const pushFromValue = (value) => {
      if (!value) return;
      String(value).split(",").forEach(part => {
        const name = part.trim().replace(/^["']|["']$/g, "").toLowerCase();
        if (name) out.add(name);
      });
    };
    pushFromValue(getComputedStyle(root).fontFamily);
    if (root.querySelectorAll) {
      Array.from(root.querySelectorAll("*")).slice(0, 250).forEach(node => {
        if (isEditorElement(node)) return;
        pushFromValue(getComputedStyle(node).fontFamily);
      });
    }
  }

  function describeLoadedFontFaces(families) {
    if (!document.fonts || typeof document.fonts.values !== "function") return "";
    const rows = [];
    try {
      for (const face of document.fonts.values()) {
        const family = String(face.family || "").replace(/["']/g, "").toLowerCase();
        if (!families.has(family)) continue;
        rows.push(`/* document.fonts: ${face.family} ${face.style || ""} ${face.weight || ""} status=${face.status || "?"} */`);
        if (rows.length >= 20) break;
      }
    } catch (_) {}
    return rows.join("\n");
  }

  // @keyframes — pull definitions referenced by animation-name on this
  // element or any descendant. Without these the consumer sees `animation-name: pulse`
  // with no idea what `pulse` does.
  function getKeyframesReport(el) {
    const names = new Set();
    collectAnimationNamesInto(el, names);
    // Catch animations on ancestor-scope elements too (e.g. .macf-step-copy
    // lives in section#coordination's subtree, not in the selected svg).
    // The Ancestor Chain section emits the rule for them; without expanding
    // here we'd reference `animation: macf-copy-in` but never define it.
    expandScopeToAncestors(el).forEach(node => collectAnimationNamesInto(node, names));
    if (!names.size) return "";
    const rows = [];
    const seen = new Set();
    Array.from(document.styleSheets || []).forEach((sheet, index) => {
      let rules;
      try { rules = sheet.cssRules; }
      catch (_) { return; }
      collectKeyframeRules(rules, sheetLabel(sheet, index), names, rows, seen);
    });
    return rows.join("\n\n");
  }

  function collectKeyframeRules(rules, source, names, rows, seen) {
    if (!rules) return;
    for (const rule of Array.from(rules)) {
      if (rule.type === 7 /* KEYFRAMES_RULE */ && rule.name) {
        if (!names.has(rule.name.toLowerCase())) continue;
        const key = `${source}::${rule.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const text = limitText(rule.cssText || "", 4000, "keyframes truncated");
        rows.push(`/* ${source} */\n${text}`);
      } else if (rule.cssRules) {
        collectKeyframeRules(rule.cssRules, source, names, rows, seen);
      }
    }
  }

  function collectAnimationNamesInto(root, out) {
    if (!root || root.nodeType !== 1) return;
    const push = (value) => {
      if (!value || value === "none") return;
      String(value).split(",").forEach(part => {
        const name = part.trim();
        if (name && name !== "none") out.add(name.toLowerCase());
      });
    };
    push(getComputedStyle(root).animationName);
    if (root.querySelectorAll) {
      Array.from(root.querySelectorAll("*")).slice(0, 250).forEach(node => {
        if (isEditorElement(node)) return;
        push(getComputedStyle(node).animationName);
      });
    }
  }

  function getReactDetailsReport(el) {
    const fiber = getReactFiber(el);
    if (!fiber) return "none";
    const rows = [];
    let walker = fiber;
    let count = 0;
    while (walker && count < 8) {
      const name = fiberDisplayName(walker);
      const source = walker._debugSource ? debugSourceText(walker._debugSource) : sourceFromDebugStack(walker);
      const shouldShow = count === 0 || source || isUserComponent(name);
      if (shouldShow) {
        rows.push({
          name,
          tag: walker.tag,
          source,
          key: walker.key == null ? undefined : String(walker.key),
          props: normalizeForReport(walker.memoizedProps, 0, new WeakSet(), "props"),
        });
        count++;
      }
      walker = walker.return;
    }
    return limitText(JSON.stringify(rows, null, 2), 50000, "React details truncated");
  }

  // Vue counterpart of React Details: the owning component chain with per-
  // component file, props and reactive state. Vue 3 setupState auto-unwraps
  // refs; Vue 2 exposes $data. Both go through normalizeForReport for masking,
  // depth limits and circular-reference safety.
  function getVueDetailsReport(el) {
    const found = getVueComponent(el);
    if (!found) return "none";
    const rows = [];
    let walker = found.instance;
    let count = 0;
    while (walker && count < 8) {
      let props = null, state = null;
      try { props = found.version === 3 ? walker.props : walker.$props; } catch (_) {}
      try { state = found.version === 3 ? walker.setupState : walker.$data; } catch (_) {}
      const row = { name: vueName(walker, found.version) || "anonymous" };
      const file = vueFile(walker, found.version);
      if (file) row.file = file;
      try {
        if (props && typeof props === "object" && Object.keys(props).length) {
          row.props = normalizeForReport(props, 0, new WeakSet(), "props");
        }
      } catch (_) {}
      try {
        if (state && typeof state === "object") {
          // <script setup> exposes imported child components and the props
          // binding through setupState — actual reactive state only, please.
          const cleaned = {};
          for (const key of Object.keys(state)) {
            let v; try { v = state[key]; } catch (_) { continue; }
            if (isVueComponentLike(v)) continue;
            if (typeof v === "function") continue;
            // The `props` setup binding mirrors instance.props (dev wraps it
            // in shallowReadonly, so reference equality never holds).
            if (key === "props" && props && v && typeof v === "object") {
              try {
                const stateKeys = Object.keys(v);
                const propKeys = Object.keys(props);
                if (stateKeys.length === propKeys.length && stateKeys.every(k => propKeys.indexOf(k) !== -1)) continue;
              } catch (_) {}
            }
            cleaned[key] = v;
          }
          if (Object.keys(cleaned).length) {
            row.state = normalizeForReport(cleaned, 0, new WeakSet(), "state");
          }
        }
      } catch (_) {}
      rows.push(row);
      count++;
      walker = vueParentInstance(walker, found.version);
    }
    if (!rows.length) return "none";
    return limitText(JSON.stringify(rows, null, 2), 50000, "Vue details truncated");
  }

  function isVueComponentLike(value) {
    if (!value || typeof value !== "object") return false;
    return !!(value.__file || value.__name || typeof value.setup === "function" || typeof value.render === "function");
  }

  // Document Context — root-level info that decides how the element is
  // styled but lives outside of it: <html>/<body> classes, viewport meta,
  // theme-color, :root CSS variables, and the page's effective root font/
  // colors/background. Without these an AI loses theme switches, design
  // tokens, and the inherited typographic baseline.
  function getDocumentContextReport() {
    const html = document.documentElement;
    const body = document.body;
    const rows = [];
    if (html) {
      const lang = html.getAttribute("lang");
      rows.push(`html: ${describeElement(html)}${lang ? ` lang="${lang}"` : ""}`);
    }
    if (body && body !== html) rows.push(`body: ${describeElement(body)}`);
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) rows.push(`viewport: ${viewport.getAttribute("content") || ""}`);
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) rows.push(`theme-color: ${themeColor.getAttribute("content") || ""}`);
    const charset = document.querySelector("meta[charset]");
    if (charset) rows.push(`charset: ${charset.getAttribute("charset")}`);

    if (html) {
      const cs = getComputedStyle(html);
      const bodyCs = body ? getComputedStyle(body) : cs;
      rows.push("");
      if (cs.colorScheme && cs.colorScheme !== "normal") rows.push(`color-scheme: ${cs.colorScheme}`);
      rows.push(`root font: ${bodyCs.fontSize} / ${bodyCs.lineHeight} ${compactCssValue(bodyCs.fontFamily)}`);
      rows.push(`root color: ${bodyCs.color}`);
      rows.push(`root background-color: ${bodyCs.backgroundColor}`);
      if (bodyCs.backgroundImage && bodyCs.backgroundImage !== "none") {
        rows.push(`root background-image: ${limitText(bodyCs.backgroundImage, 1000, "background truncated")}`);
      }
      const vars = [];
      for (let i = 0; i < cs.length; i++) {
        const name = cs[i];
        if (!name || !name.startsWith("--")) continue;
        vars.push(`  ${name}: ${limitText(cs.getPropertyValue(name).trim(), 200, "var truncated")}`);
        if (vars.length >= 80) { vars.push("  ... root CSS variables truncated"); break; }
      }
      if (vars.length) rows.push("", "root CSS variables:", ...vars);
    }
    return rows.join("\n");
  }

  // Context — parent + siblings + landmark region. The single home for
  // surrounding structure (previously duplicated across Fast Locator,
  // Rendered Layout, and Nearby Context).
  function getContextReport(el) {
    const rows = [];
    const p = el.parentElement;
    if (p && p !== document.body && p !== document.documentElement) {
      rows.push(`parent: ${describeElement(p)}`);
      const pLayout = getParentContextStr(el);
      if (pLayout) rows.push(`parent layout: ${pLayout}`);
    }
    const semantic = getSemanticContextStr(el);
    if (semantic) rows.push(`semantic: ${semantic}`);
    if (p) {
      const siblings = Array.from(p.children || []).filter(child => !isEditorElement(child));
      const index = siblings.indexOf(el);
      rows.push(`sibling: ${index + 1} of ${siblings.length}`);
      const start = Math.max(0, index - 2);
      const end = Math.min(siblings.length, index + 3);
      siblings.slice(start, end).forEach((sib, i) => {
        const actual = start + i;
        const marker = actual === index ? "►" : " ";
        const text = directText(sib);
        rows.push(`  ${marker} ${actual + 1}: ${describeElement(sib)}${text ? ` text="${truncate(text, 60)}"` : ""}`);
      });
    }
    const region = nearestRegionContext(el);
    if (region) rows.push(`region: ${region}`);
    return rows.join("\n") || "none";
  }

  function buildDomPath(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1) {
      let part = node.tagName.toLowerCase();
      if (node.id && isStableToken(node.id)) {
        part += `#${node.id}`;
        parts.unshift(part);
        break;
      }
      const cls = stableClasses(node)[0];
      if (cls) part += `.${cls}`;
      const p = node.parentElement;
      if (p) {
        const sameTag = Array.from(p.children).filter(child => child.tagName === node.tagName);
        if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      if (node === document.documentElement) break;
      node = p;
    }
    return parts.join(" > ");
  }

  function buildXPath(el) {
    if (el.id && isStableToken(el.id)) return `//*[@id=${xpathLiteral(el.id)}]`;
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1) {
      const tag = node.tagName.toLowerCase();
      const p = node.parentElement;
      if (!p) { parts.unshift(tag); break; }
      const sameTag = Array.from(p.children).filter(child => child.tagName === node.tagName);
      const index = sameTag.length > 1 ? `[${sameTag.indexOf(node) + 1}]` : "";
      parts.unshift(`${tag}${index}`);
      node = p;
    }
    return "/" + parts.join("/");
  }

  function xpathLiteral(value) {
    value = String(value);
    if (!value.includes("'")) return `'${value}'`;
    if (!value.includes('"')) return `"${value}"`;
    return "concat(" + value.split("'").map(part => `'${part}'`).join(', "\'", ') + ")";
  }

  function describeElement(el) {
    if (!el || !el.tagName) return "";
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = Array.from(el.classList || []).slice(0, 6).map(c => "." + c).join("");
    const role = el.getAttribute("role");
    const testId = el.getAttribute("data-testid") || el.getAttribute("data-test") || el.getAttribute("data-cy") || el.getAttribute("data-qa");
    const label = el.getAttribute("aria-label") || el.getAttribute("title") || "";
    return `<${tag}${id}${cls}>${role ? ` role="${role}"` : ""}${testId ? ` test="${testId}"` : ""}${label ? ` label="${truncate(label, 60)}"` : ""}`;
  }

  function directText(el) {
    if (!el || !el.childNodes) return "";
    return Array.from(el.childNodes).filter(node => node.nodeType === 3).map(node => node.textContent).join(" ").replace(/\s+/g, " ").trim();
  }

  function cssValue(cs, prop) {
    return limitText(String(cs.getPropertyValue(prop) || "").replace(/\s+/g, " ").trim(), 1600, "value truncated");
  }

  function limitText(value, max, label) {
    value = String(value == null ? "" : value);
    if (value.length <= max) return value;
    let cut = value.slice(0, max);
    // If the cut may have sliced through a token-like run of chars, back up
    // to the previous whitespace/delimiter so we never leak a token prefix.
    const tail = cut.slice(-96);
    if (/[A-Za-z0-9._/+=-]{32,}$/.test(tail)) {
      const safeIdx = cut.search(/[\s"'<>(){}[\];,][^\s"'<>(){}[\];,]{0,95}$/);
      if (safeIdx > 0 && cut.length - safeIdx < 128) cut = cut.slice(0, safeIdx);
    }
    return cut + `\n... ${label || "truncated"} (${value.length - cut.length} chars omitted)`;
  }

  function round2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function safeReportValue(name, value, max) {
    if (isSensitiveName(name) || isTokenLikeValue(value)) return maskedValue(value);
    return limitText(String(value == null ? "" : value), max || 2000, "value truncated");
  }

  function isSensitiveName(name) {
    return /(password|passwd|token|secret|authorization|auth|session|cookie|csrf|xsrf|api[_-]?key|apikey|access[_-]?key|private[_-]?key|client[_-]?secret|refresh[_-]?token|id[_-]?token|credential|signature|sig)/i.test(String(name || ""));
  }

  function isTokenLikeValue(value) {
    value = String(value || "");
    if (value.length < 48) return false;
    if (/^eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+$/i.test(value)) return true;
    if (/^(bearer|basic)\s+/i.test(value)) return true;
    if (/^[a-f0-9]{48,}$/i.test(value)) return true;
    if (/^[a-z0-9_/-]{80,}={0,2}$/i.test(value)) return true;
    return false;
  }

  function maskedValue(value) {
    value = String(value == null ? "" : value);
    return `[masked sensitive value, length ${value.length}]`;
  }

  function fiberDisplayName(fiber) {
    if (!fiber) return "unknown";
    if (typeof fiber.type === "string") return fiber.type;
    if (fiber.type) return fiber.type.displayName || fiber.type.name || fiber.elementType && (fiber.elementType.displayName || fiber.elementType.name) || "anonymous";
    if (fiber.elementType) return fiber.elementType.displayName || fiber.elementType.name || "anonymous";
    return "unknown";
  }

  function debugSourceText(source) {
    if (!source) return "";
    const file = source.fileName ? source.fileName.replace(/^.*?\/src\//, "src/") : "";
    return `${file}${source.lineNumber ? `:${source.lineNumber}` : ""}${source.columnNumber ? `:${source.columnNumber}` : ""}`;
  }

  function normalizeForReport(value, depth, seen, key) {
    if (key && isSensitiveName(key)) return maskedValue(value);
    if (value == null || typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value === "string") return isTokenLikeValue(value) ? maskedValue(value) : limitText(value, 4000, "string truncated");
    if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
    if (typeof value === "symbol") return String(value);
    if (typeof Node !== "undefined" && value instanceof Node) return `[${value.nodeType === 1 ? describeElement(value) : "Node"}]`;
    if (depth >= 4) return Array.isArray(value) ? `[Array(${value.length})]` : "[Object]";
    if (typeof value === "object") {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
      if (value.$$typeof && value.props) return `[ReactElement ${reactElementName(value)}]`;
      if (Array.isArray(value)) return value.slice(0, 30).map((item, i) => normalizeForReport(item, depth + 1, seen, String(i))).concat(value.length > 30 ? [`... ${value.length - 30} more items`] : []);
      const out = {};
      const entries = Object.entries(value).filter(([k]) => !k.startsWith("__")).slice(0, 60);
      entries.forEach(([k, v]) => {
        out[k] = k === "children" ? summarizeReactChildren(v) : normalizeForReport(v, depth + 1, seen, k);
      });
      const total = Object.keys(value).length;
      if (total > entries.length) out.__truncated = `${total - entries.length} more keys`;
      return out;
    }
    return String(value);
  }

  function summarizeReactChildren(value) {
    if (value == null) return value;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
    if (Array.isArray(value)) return `[ReactChildren count=${value.length}]`;
    if (typeof value === "object" && value.$$typeof) return `[ReactElement ${reactElementName(value)}]`;
    return "[ReactChildren]";
  }

  function reactElementName(value) {
    const type = value && value.type;
    if (typeof type === "string") return type;
    return type && (type.displayName || type.name) || "anonymous";
  }

// ── Computed styles ────────────────────────────────────────
  const LAYOUT_STYLE_KEYS = ["display","flex-direction","align-items","justify-content","gap","grid-template-columns","padding","margin","width","height","position","z-index","overflow","text-align"];
  function getLayoutSummary(el) {
    const cs = getComputedStyle(el);
    const keys = smartStyleKeys(el, cs);
    return keys.map(k => `${k}:${compactCssValue(cs.getPropertyValue(k))}`).filter(s => !s.endsWith(":")).join("; ");
  }

  // ── Parent context ─────────────────────────────────────────
  function getParentContextStr(el) {
    const p = el.parentElement;
    if (!p || p === document.body || p === document.documentElement) return null;
    const tag = p.tagName.toLowerCase();
    const id = p.id && isStableToken(p.id) ? `#${p.id}` : "";
    const cls = stableClasses(p).slice(0, 2).map(c => "." + c).join("");
    const cs = getComputedStyle(p);
    const bits = [`<${tag}${id}${cls}>`, `display:${cs.display}`];
    if (cs.display.includes("flex")) bits.push(`flex-direction:${cs.flexDirection}`, `align-items:${cs.alignItems}`, `justify-content:${cs.justifyContent}`);
    if (cs.display.includes("grid")) bits.push(`grid-template-columns:${compactCssValue(cs.gridTemplateColumns)}`);
    if (cs.gap && cs.gap !== "normal") bits.push(`gap:${cs.gap}`);
    return bits.join("; ");
  }

  function smartStyleKeys(el, cs) {
    const keys = ["display"];
    if (cs.display.includes("flex")) keys.push("flex-direction","align-items","justify-content","gap");
    if (cs.display.includes("grid")) keys.push("grid-template-columns","gap");
    if (selectedElements.length > 1 || isPositioned(el)) keys.push("width","height");
    if (cs.position !== "static") keys.push("position","z-index");
    if (isScrollable(el)) keys.push("overflow");
    return unique(keys).filter(k => LAYOUT_STYLE_KEYS.includes(k));
  }

  function shouldIncludeLayout(el) {
    const cs = getComputedStyle(el);
    if (selectedElements.length > 1) return hasMeaningfulLayout(el, cs) && !isSimpleInlineLabel(el, cs);
    if (cs.position !== "static" || isScrollable(el)) return true;
    if (cs.display.includes("grid")) return true;
    if (cs.display.includes("flex")) {
      const children = visibleChildren(el);
      if (children.length > 1) return true;
      if (hasNonDefaultFlex(cs) && !isSimpleInlineLabel(el, cs)) return true;
    }
    return false;
  }

  function shouldIncludeParent(el) {
    const p = el.parentElement;
    if (!p || p === document.body || p === document.documentElement) return false;
    const cs = getComputedStyle(p);
    if (selectedElements.length > 1) return (cs.display.includes("flex") || cs.display.includes("grid")) && visibleChildren(p).length > 1;
    if (isAtomicElement(el)) return false;
    if (isInsideStructuredContainer(el)) return false;
    if (cs.display.includes("grid")) return visibleChildren(p).length > 1;
    if (cs.display.includes("flex")) return visibleChildren(p).length > 2 || isPrimaryLayoutContainer(p);
    return false;
  }

  function shouldIncludeHtml(el, ctx) {
    if (ctx.text || ctx.locator || ctx.source || ctx.react || ctx.vue || Object.keys(ctx.dataAttrs).length) return false;
    if (el.children.length > 4) return false;
    if (ctx.selector && !ctx.selector.includes("nth-of-type") && !ctx.selector.startsWith("body >")) return false;
    return true;
  }

  function compactCssValue(value) {
    if (!value) return "";
    value = value.replace(/\s+/g, " ").trim();
    return value.length > 80 ? value.slice(0, 80) + "\u2026" : value;
  }

  function unique(values) {
    return Array.from(new Set(values));
  }

  // ── React debug info ───────────────────────────────────────
  const SKIP_REACT = new Set(["ClientPageRoot","LinkComponent","ServerComponent","AppRouter","Router","HotReload","ReactDevOverlay","InnerLayoutRouter","OuterLayoutRouter","RedirectBoundary","NotFoundBoundary","ErrorBoundary","LoadingBoundary","TemplateContext","ScrollAndFocusHandler","RenderFromTemplateContext","PathnameContextProviderAdapter","Hot","Inner","Forward","Root"]);
  function isUserComponent(name) { return name && name.length >= 2 && !SKIP_REACT.has(name) && /^[A-Z]/.test(name) && !name.startsWith("_"); }

  function getReactFiber(el) {
    try {
      const key = Object.keys(el).find(k => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance"));
      return key ? el[key] : null;
    } catch(_) { return null; }
  }

  function getReactDebug(el) {
    try {
      const f = getReactFiber(el); if (!f) return {};
      const result = {};
      let walker = f;
      while (walker) { if (walker._debugSource) { const s=walker._debugSource; result.source=`${s.fileName.replace(/^.*?\/src\//, "src/")}:${s.lineNumber}`; break; } walker=walker.return; }
      if (!result.source) {
        // React 19 removed fiber._debugSource; dev builds carry _debugStack
        // (an Error captured at element creation) instead.
        walker = f;
        let depth = 0;
        while (walker && depth++ < 30) {
          const stackSource = sourceFromDebugStack(walker);
          if (stackSource) { result.source = stackSource; break; }
          walker = walker.return;
        }
      }
      const components = [];
      walker = f;
      while (walker) {
        if (walker.type && typeof walker.type === "function") {
          const name = walker.type.displayName || walker.type.name;
          if (isUserComponent(name) && !components.includes(name)) { components.push(name); if (components.length >= 3) break; }
        }
        walker = walker.return;
      }
      if (components.length) result.react = components.reverse().join(" \u203a ");
      return result;
    } catch(_) { return {}; }
  }

  // Parse a React 19 _debugStack (dev-only Error) for the JSX callsite.
  // Handles the URL shapes dev servers actually emit: plain dev-server paths
  // (Vite: http://localhost:5173/src/App.tsx?t=123:12:5) and webpack bundles
  // (webpack-internal:///(app-pages-browser)/./src/app/page.tsx:12:88).
  function sourceFromDebugStack(node) {
    try {
      const stack = node && node._debugStack && node._debugStack.stack;
      if (!stack) return "";
      for (const line of String(stack).split("\n")) {
        const loc = stackFrameLocation(line);
        if (loc) return loc;
      }
    } catch (_) {}
    return "";
  }

  function stackFrameLocation(line) {
    // Lazy \S+? keeps parenthesised webpack-internal URLs intact while the
    // trailing anchor still peels off Chrome's closing ")".
    const m = String(line).match(/((?:webpack-internal|https?|file):\/\/\S+?):(\d+):(\d+)\)?\s*$/);
    if (!m) return "";
    let file = m[1];
    if (/node_modules|react-stack-top-frame|chrome-extension:/.test(file)) return "";
    file = file.replace(/^webpack-internal:\/\/\/(\([^)]*\))?\.?\/?/, "");
    file = file.replace(/^(?:https?|file):\/\/[^/]*\//, "");
    file = file.split("?")[0];
    if (!/\.(jsx|tsx|js|ts|mjs|vue|svelte)$/.test(file)) return "";
    file = file.replace(/^.*?src\//, "src/").replace(/^\.\//, "");
    return `${file}:${m[2]}`;
  }

  // ── Vue debug info ─────────────────────────────────────────
  // Vue 3 (dev) marks elements with __vueParentComponent (the owning component
  // instance); Vue 2 marks component roots with __vue__. Walk up the DOM to the
  // nearest marker, then climb the component parent chain.
  function getVueComponent(el) {
    let node = el;
    let depth = 0;
    while (node && depth++ < 25) {
      try {
        if (node.__vueParentComponent) return { version: 3, instance: node.__vueParentComponent };
        if (node.__vue__) return { version: 2, instance: node.__vue__ };
      } catch (_) { return null; }
      node = node.parentElement;
    }
    return null;
  }

  function vueOptions(instance, version) {
    return version === 3 ? instance && instance.type : instance && instance.$options;
  }

  function vueFile(instance, version) {
    try {
      const options = vueOptions(instance, version);
      const file = options && options.__file;
      if (!file) return "";
      return String(file).replace(/\\/g, "/").replace(/^.*?src\//, "src/");
    } catch (_) { return ""; }
  }

  function vueName(instance, version) {
    try {
      const options = vueOptions(instance, version);
      if (!options) return "";
      const name = options.name || options.__name;
      if (name) return name;
      const match = vueFile(instance, version).match(/([^/]+)\.vue$/);
      return match ? match[1] : "";
    } catch (_) { return ""; }
  }

  function vueParentInstance(instance, version) {
    try { return version === 3 ? instance.parent : instance.$parent; }
    catch (_) { return null; }
  }

  function getVueDebug(el) {
    try {
      const found = getVueComponent(el);
      if (!found) return {};
      const result = {};
      const names = [];
      let walker = found.instance;
      let depth = 0;
      while (walker && depth++ < 25) {
        if (!result.source) {
          const file = vueFile(walker, found.version);
          if (file) result.source = file;
        }
        const name = vueName(walker, found.version);
        if (name && isUserComponent(name) && !names.includes(name)) {
          names.push(name);
          if (names.length >= 3) break;
        }
        walker = vueParentInstance(walker, found.version);
      }
      if (names.length) result.vue = names.reverse().join(" \u203a ");
      return result;
    } catch(_) { return {}; }
  }

  // Component props are only attributable to the element when it IS the
  // component root; deeper template elements would inherit misleading props.
  function getVuePropsInfo(el) {
    try {
      const found = getVueComponent(el);
      if (!found) return "";
      const inst = found.instance;
      const rootEl = found.version === 3 ? (inst.vnode && inst.vnode.el) : inst.$el;
      if (rootEl !== el) return "";
      const props = found.version === 3 ? inst.props : inst.$props;
      if (!props || typeof props !== "object") return "";
      const useful = [];
      for (const k of Object.keys(props)) {
        if (k.startsWith("__") || k === "class" || k === "style") continue;
        if (isSensitiveName(k)) { useful.push(`${k}:[masked]`); continue; }
        let v; try { v = props[k]; } catch (_) { continue; }
        if (v === null || v === undefined) useful.push(`${k}:null`);
        else if (typeof v === "function") useful.push(`${k}:fn`);
        else if (typeof v === "object") {
          try { const s = JSON.stringify(v); useful.push(`${k}:${s.length > 60 ? s.slice(0, 60) + "\u2026" : s}`); }
          catch (_) { useful.push(`${k}:{...}`); }
        }
        else useful.push(`${k}:${truncate(String(v), 80)}`);
        if (useful.length >= 8) break;
      }
      return useful.join(", ");
    } catch(_) { return ""; }
  }

  // ── Host test locators (HOST_CONTRACT.md §1.7) ─────────────
  // Pro supplies ready-to-paste test locators with uniqueness annotations.
  // Bookmarklet has no HOST.buildTestLocators → returns null → no output.
  function hostTestLocators(el) {
    if (!HOST.buildTestLocators) return null;
    try {
      const rows = HOST.buildTestLocators(el);
      if (Array.isArray(rows) && rows.length) {
        const cleaned = rows.map(r => truncate(String(r), 200)).filter(Boolean).slice(0, 6);
        if (cleaned.length) return cleaned;
      }
    } catch (_) {}
    return null;
  }

  function getReactPropsInfo(el) {
    try {
      const f = getReactFiber(el); if (!f) return null;
      const props = f.memoizedProps; if (!props || typeof props !== "object") return null;
      const entries = Object.entries(props).filter(([k]) => k !== "children" && !k.startsWith("__"));
      if (!entries.length) return { className: "", props: "" };
      let className = "";
      const useful = [];
      entries.forEach(([k, v]) => {
        if (k === "className" && typeof v === "string") { className = v; return; }
        if (!isUsefulReactProp(k, v)) return;
        if (v === null || v === undefined) { useful.push(`${k}:null`); return; }
        if (typeof v === "function") { useful.push(`${k}:fn`); return; }
        if (typeof v === "object") {
          try {
            const s=JSON.stringify(v);
            useful.push(`${k}:${s.length > 60 ? s.slice(0, 60) + "\u2026" : s}`);
          } catch(_) { useful.push(`${k}:{...}`); }
          return;
        }
        useful.push(`${k}:${truncate(String(v), 80)}`);
      });
      return { className, props: useful.slice(0, 8).join(", ") };
    } catch(_) { return null; }
  }

  function isUsefulReactProp(key, value) {
    if (/^(id|role|type|name|href|to|for|htmlFor|target|rel|title|alt|placeholder|value|defaultValue)$/.test(key)) return value !== "";
    if (/^(variant|size|tone|color|status|state|kind|intent|as|label)$/.test(key)) return true;
    if (/^(disabled|selected|checked|open|active|expanded|pressed|required|readOnly)$/.test(key)) return true;
    if (/^aria-/.test(key)) return true;
    if (/^data-/.test(key)) return isUsefulDataValue(key, value);
    return false;
  }

  function isUsefulDataAttr(attr) {
    if (!attr || !attr.name || attr.name === AI_ID || !attr.name.startsWith("data-")) return false;
    if (/^data-(test|testid|test-id|cy|qa|state|slot|value|name|variant|status|selected|disabled|orientation)$/.test(attr.name)) return true;
    if (/^data-(pjax|turbo|hovercard|analytics|octo|view-component|hydrated|rr-ui|react)/.test(attr.name)) return false;
    if (/^(true|false|0|1)$/.test(attr.value || "")) return false;
    return attr.value && attr.value.length <= 80 && isStableToken(attr.value);
  }

  function isUsefulDataValue(key, value) {
    if (/^data-(test|testid|test-id|cy|qa|state|slot|value|name|variant|status|selected|disabled|orientation)$/.test(key)) return true;
    if (/^data-(pjax|turbo|hovercard|analytics|octo|view-component|hydrated|rr-ui|react)/.test(key)) return false;
    if (value === true || value === false || value === 0 || value === 1) return false;
    if (/^(true|false|0|1)$/.test(String(value))) return false;
    return value !== null && value !== undefined && String(value).length <= 80 && isStableToken(String(value));
  }

  // ── Element context ────────────────────────────────────────
  function buildElementContext(el, index, note) {
    const dataAttrs = {};
    for (const attr of Array.from(el.attributes).filter(isUsefulDataAttr).slice(0, 8)) {
      dataAttrs[attr.name] = truncate(attr.value, 120);
    }
    const reactInfo = getReactDebug(el);
    const vueInfo = (reactInfo.react || reactInfo.source) ? {} : getVueDebug(el);
    const reactProps = getReactPropsInfo(el) || { className: "", props: "" };
    const frameworkProps = reactProps.props || getVuePropsInfo(el);
    const classTokens = unique([
      ...Array.from(el.classList),
      ...String(reactProps.className || "").split(/\s+/).filter(Boolean),
    ]);
    const rawSelector = buildSelector(el);
    const locator = buildLocator(el);
    const text = readableText(el);
    const ctx = {
      index, aiId: el.getAttribute(AI_ID), locator, tag: el.tagName.toLowerCase(),
      text: shouldIncludeText(text, locator) ? text : "", classes: classTokens,
      dataAttrs, reactProps: frameworkProps, ...reactInfo, ...vueInfo,
    };
    ctx.title = contextTitle(el, ctx);
    ctx.inside = getSemanticContextStr(el);
    ctx.visual = getVisualSummary(el, ctx, classTokens);
    if (shouldIncludeSelector(rawSelector, ctx)) ctx.selector = rawSelector;
    if (shouldIncludeLayout(el)) ctx.layout = getLayoutSummary(el);
    if (shouldIncludeParent(el)) ctx.parent = getParentContextStr(el);
    if (shouldIncludeHtml(el, ctx)) ctx.outerHTML = truncateHtml(el.outerHTML, 240);
    return ctx;
  }

  function contextTitle(el, ctx) {
    const label = accessibleLabel(el);
    const kind = elementKind(el, ctx);
    return label ? `${kind} "${truncate(label, 48)}"` : kind;
  }

  function elementKind(el, ctx) {
    const reactLast = ctx.react && ctx.react.split(" \u203a ").pop();
    if (reactLast && /^[A-Z]/.test(reactLast)) return reactLast;
    const vueLast = ctx.vue && ctx.vue.split(" \u203a ").pop();
    if (vueLast && /^[A-Z]/.test(vueLast)) return vueLast;
    const role = explicitOrImplicitRole(el);
    if (role) return role;
    const tag = el.tagName.toLowerCase();
    const classBlob = ctx.classes.join(" ").toLowerCase();
    if (/badge|tag|chip|pill/.test(classBlob)) return "Badge";
    if (/card|panel|tile/.test(classBlob)) return "Card";
    if (/avatar/.test(classBlob)) return "Avatar";
    if (/icon/.test(classBlob)) return "Icon";
    return tag;
  }

  function readableText(el) {
    return truncate(visibleText(el), 80);
  }

  function shouldIncludeText(text, locator) {
    if (!text) return false;
    if (!locator) return true;
    return !locator.includes(`"${truncate(text, 48)}"`);
  }

  function shouldIncludeSelector(selector, ctx) {
    if (!selector) return false;
    const durableDirect = selector.length <= 120 && (/^#/.test(selector) || /^\[data-/.test(selector) || /^[a-z]+\[data-/.test(selector));
    if (durableDirect) return true;
    const hasStrongIdentity = ctx.locator || ctx.react || ctx.vue || ctx.source || ctx.text || Object.keys(ctx.dataAttrs).length;
    if (hasStrongIdentity) return false;
    return selector.length <= 180;
  }

  function getSemanticContextStr(el) {
    const parts = [];
    const cell = el.closest("td,th");
    if (cell) {
      const header = tableHeaderForCell(cell);
      parts.push(header ? `table cell under "${header}"` : "table cell");
    }
    const li = el.closest("li");
    if (li) parts.push("list item");
    const field = nearestFieldContext(el);
    if (field) parts.push(field);
    const region = nearestRegionContext(el);
    if (region) parts.push(region);
    return unique(parts).slice(0, 2).join("; ");
  }

  function tableHeaderForCell(cell) {
    try {
      if (cell.tagName.toLowerCase() !== "td") return null;
      const table = cell.closest("table");
      const row = cell.closest("tr");
      if (!table || !row || cell.cellIndex < 0) return null;
      const header = table.querySelector(`thead tr th:nth-child(${cell.cellIndex + 1})`);
      return header ? truncate(header.textContent, 36) : null;
    } catch(_) { return null; }
  }

  function nearestFieldContext(el) {
    const label = el.closest("label");
    if (label) return `field "${truncate(label.textContent, 36)}"`;
    const form = el.closest("form");
    if (form) return "form";
    return null;
  }

  function nearestRegionContext(el) {
    const region = el.closest("dialog,[role='dialog'],[role='menu'],[role='tablist'],nav,aside,header,footer,main,section,article");
    if (!region || region === el) return null;
    const role = explicitOrImplicitRole(region) || region.getAttribute("role") || region.tagName.toLowerCase();
    const label = region.getAttribute("aria-label") || region.getAttribute("title") || nearestHeadingText(region);
    return label ? `${role} "${truncate(label, 36)}"` : role;
  }

  function nearestHeadingText(region) {
    const heading = region.querySelector("h1,h2,h3,h4,h5,h6");
    return heading ? heading.textContent : "";
  }

  function getVisualSummary(el, ctx, classTokens) {
    const parts = [];
    const cs = getComputedStyle(el);
    const classBlob = classTokens.join(" ");
    const lower = classBlob.toLowerCase();
    const kind = elementKind(el, ctx).toLowerCase();
    const hasStyleTokens = hasVisualClassTokens(classTokens);
    if (!hasStyleTokens && isAtomicElement(el) && kind !== "badge") return "";
    if (/badge|tag|chip|pill/.test(lower) || kind === "badge") parts.push("badge");
    if (/(rounded-full|pill)/.test(lower) || parseFloat(cs.borderRadius) >= Math.min(el.offsetHeight, el.offsetWidth) / 3) parts.push("pill");
    else if ((cs.borderRadius && cs.borderRadius !== "0px") || /rounded/.test(lower)) parts.push("rounded");
    if (hasBorder(cs) || /\bborder\b|border-/.test(lower)) parts.push("border");
    if (hasBackground(cs) || /\bbg-/.test(lower)) parts.push(colorToken(lower, "bg") || "background");
    if (hasForeground(cs) || /\btext-/.test(lower)) {
      const textTone = textSizeToken(lower);
      if (textTone) parts.push(textTone);
      const color = colorToken(lower, "text");
      if (color && color !== "text-xs" && color !== "text-sm" && color !== "text-lg" && color !== "text-xl") parts.push(color);
    }
    if (/shadow/.test(lower) || cs.boxShadow !== "none") parts.push("shadow");
    return unique(parts).slice(0, 6).join(", ");
  }

  function hasVisualClassTokens(tokens) {
    return tokens.some(token => /^(inline-flex|flex|grid|items-|justify-|gap-|rounded|border|bg-|text-|shadow|ring|opacity|px-|py-|p-|m-|badge|tag|chip|pill)/.test(token));
  }

  function colorToken(classBlob, prefix) {
    const match = classBlob.match(new RegExp(`\\b${prefix}-([a-z][a-z0-9-]*(?:/[0-9]+)?)`));
    if (prefix === "text" && match && /^(xs|sm|base|lg|xl|[2-9]xl)$/.test(match[1])) return "";
    return match ? `${prefix}-${match[1]}` : "";
  }

  function textSizeToken(classBlob) {
    if (/text-\[(?:9|10|11|12)px\]|text-xs/.test(classBlob)) return "tiny text";
    if (/text-sm/.test(classBlob)) return "small text";
    if (/text-lg|text-xl|text-2xl|text-3xl/.test(classBlob)) return "large text";
    return "";
  }

  function hasBorder(cs) {
    return ["Top","Right","Bottom","Left"].some(side => parseFloat(cs[`border${side}Width`]) > 0);
  }

  function hasBackground(cs) {
    return cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent";
  }

  function hasForeground(cs) {
    return cs.color && cs.color !== "rgba(0, 0, 0, 0)" && cs.color !== "transparent";
  }

  function visibleChildren(el) {
    return Array.from(el.children).filter(isVisible);
  }

  function hasMeaningfulLayout(el, cs) {
    return cs.display.includes("grid") || cs.display.includes("flex") || cs.position !== "static" || isScrollable(el);
  }

  function hasNonDefaultFlex(cs) {
    return cs.flexDirection !== "row" || cs.alignItems !== "normal" || cs.justifyContent !== "normal" || (cs.gap && cs.gap !== "normal" && cs.gap !== "0px");
  }

  function isSimpleInlineLabel(el, cs) {
    return cs.display.includes("flex") && visibleChildren(el).length <= 1 && readableText(el) && el.getBoundingClientRect().height <= 40;
  }

  function isScrollable(el) {
    const cs = getComputedStyle(el);
    return /(auto|scroll)/.test(`${cs.overflow} ${cs.overflowX} ${cs.overflowY}`);
  }

  function isPositioned(el) {
    return getComputedStyle(el).position !== "static";
  }

  function isInsideStructuredContainer(el) {
    return !!el.closest("td,th,li,label");
  }

  function isPrimaryLayoutContainer(el) {
    const tag = el.tagName.toLowerCase();
    if (/^(main|section|article|aside|nav|header|footer)$/.test(tag)) return true;
    return /\b(container|layout|grid|row|toolbar|header|footer|sidebar|content)\b/i.test(Array.from(el.classList).join(" "));
  }

  function buildSelector(el) {
    const direct = bestDirectSelector(el);
    if (direct) return direct;
    const parts = []; let node = el;
    while (node && node !== document.body && node !== document.documentElement) {
      const stable = stableSegment(node);
      if (stable) {
        parts.unshift(stable);
        const candidate = parts.join(" > ");
        if (isUniqueSelector(candidate)) return candidate;
        if (stable.startsWith("#")) break;
        node = node.parentElement;
        continue;
      }
      let seg = node.tagName.toLowerCase();
      const p = node.parentElement;
      if (p) { const s = Array.from(p.children).filter(c => c.tagName === node.tagName); if (s.length > 1) seg += `:nth-of-type(${s.indexOf(node) + 1})`; }
      parts.unshift(seg); node = node.parentElement;
    }
    return parts.join(" > ");
  }

  function truncate(s, max) { if (!s) return ""; s = s.replace(/\s+/g, " ").trim(); return s.length > max ? s.slice(0, max) + "\u2026" : s; }
  function truncateHtml(s, max) { if (!s) return ""; s = s.replace(/\s+/g, " ").trim(); return s.length > max ? s.slice(0, max) + "\u2026" : s; }

  function bestDirectSelector(el) {
    const tag = el.tagName.toLowerCase();
    const attrs = ["data-testid","data-test","data-cy","data-qa","data-test-id"];
    for (const name of attrs) {
      const value = el.getAttribute(name);
      if (!value) continue;
      const selector = `[${name}="${escapeAttr(value)}"]`;
      if (isUniqueSelector(selector)) return selector;
      const tagged = `${tag}${selector}`;
      if (isUniqueSelector(tagged)) return tagged;
    }
    if (el.id && isStableToken(el.id)) {
      const selector = `#${escapeIdent(el.id)}`;
      if (isUniqueSelector(selector)) return selector;
    }
    for (const name of ["aria-label","name","title"]) {
      const value = el.getAttribute(name);
      if (!value || value.length > 80) continue;
      const selector = `${tag}[${name}="${escapeAttr(value)}"]`;
      if (isUniqueSelector(selector)) return selector;
    }
    const classSelector = semanticClassSelector(el);
    if (classSelector && isUniqueSelector(classSelector)) return classSelector;
    return null;
  }

  function stableSegment(el) {
    const direct = bestDirectSelector(el);
    if (direct) return direct;
    if (el.id && isStableToken(el.id)) return `#${escapeIdent(el.id)}`;
    const cls = stableClasses(el)[0];
    if (cls) return `${el.tagName.toLowerCase()}.${escapeIdent(cls)}`;
    return null;
  }

  function semanticClassSelector(el) {
    const classes = stableClasses(el).slice(0, 2);
    if (!classes.length) return null;
    return `${el.tagName.toLowerCase()}${classes.map(c => "." + escapeIdent(c)).join("")}`;
  }

  function stableClasses(el) {
    return Array.from(el.classList).filter(isStableClass);
  }

  function isStableClass(cls) {
    if (!isStableToken(cls)) return false;
    if (cls.includes(":")) return false;
    if (/^(sm|md|lg|xl|2xl|hover|focus|active|disabled):/.test(cls)) return false;
    if (/^(border|rounded|shadow|ring|flex|grid|block|inline|inline-flex|hidden|relative|absolute|fixed|sticky|static|container)$/.test(cls)) return false;
    if (/^-?(m[trblxy]?|p[trblxy]?|w|h|min-w|max-w|min-h|max-h|text|bg|border|rounded|shadow|grid|flex|gap|space|items|justify|content|self|place|font|leading|tracking|opacity|z|top|right|bottom|left|inset|translate|scale|rotate)-/.test(cls)) return false;
    return true;
  }

  function isStableToken(value) {
    if (!value || value.length > 80) return false;
    if (/^[:_]?r[\w-]*:?$/i.test(value)) return false;
    if (/^[a-f0-9]{6,}$/i.test(value)) return false;
    if (/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}/i.test(value)) return false;
    if (/^(css|sc|_)[-_a-z0-9]{4,}$/i.test(value)) return false;
    if (!/[a-z]/i.test(value)) return false;
    return true;
  }

  function buildLocator(el) {
    const role = explicitOrImplicitRole(el);
    const label = accessibleLabel(el);
    if (role && label) return `${role} "${label}"`;
    if (label) return `${el.tagName.toLowerCase()} "${label}"`;
    return role || null;
  }

  function explicitOrImplicitRole(el) {
    const role = el.getAttribute("role");
    if (role) return role.split(/\s+/)[0];
    const tag = el.tagName.toLowerCase();
    if (tag === "button") return "button";
    if (tag === "a" && el.getAttribute("href")) return "link";
    if (tag === "input") return inputRole(el);
    if (tag === "select") return "combobox";
    if (tag === "textarea") return "textbox";
    if (/^h[1-6]$/.test(tag)) return "heading";
    if (tag === "img") return "img";
    return null;
  }

  function inputRole(el) {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (type === "checkbox" || type === "radio" || type === "button" || type === "searchbox") return type;
    if (type === "submit" || type === "reset") return "button";
    return "textbox";
  }

  function accessibleLabel(el) {
    const direct = el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("placeholder") || el.getAttribute("alt") || el.getAttribute("name");
    if (direct) return truncate(direct, 48);
    const text = truncate(visibleText(el), 48);
    return text || null;
  }

  function visibleText(el) {
    return (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function isUniqueSelector(selector) {
    try { return document.querySelectorAll(selector).length === 1; }
    catch(_) { return false; }
  }

  function escapeIdent(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function escapeAttr(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }


// ── Measure mode (vibe-selector extension only) ────────────
// Figma-style inspection: hold Alt (⌥) and hover to see the selection's size
// and the gaps between it and the element under the cursor.
// Visual language: 1px red guide lines with end ticks, 12px red labels (px
// units) above the lines, a red box + tag chip marking the hovered element.
// Alt is used instead of Ctrl because Ctrl collides with browser extensions.
//
// Appended INTO the picker closure by scripts/build.js (before Boot). Uses
// closure symbols: NS, on, minimized, paused, selectedElements,
// isEditorElement, resolveEventTarget, resolveTarget, mountSelectorSurface.
let measureLayer = null, measureRaf = false, measureHasAlt = false;
let measureLastPos = null;

function measureEl_(cls) {
  const d = document.createElement("div");
  d.className = `${NS}-measure-${cls}`;
  d.style.setProperty("pointer-events", "none", "important");
  return d;
}

function measureEnsureLayer() {
  if (measureLayer && measureLayer.isConnected) return measureLayer;
  measureLayer = measureEl_("layer");
  measureLayer.classList.add(`${NS}-root`);
  measureLayer.style.display = "none";
  mountSelectorSurface(measureLayer);
  return measureLayer;
}

function measureSuppressHover() {
  const hover = document.querySelector(`.${NS}-hover-box`);
  if (hover) hover.style.setProperty("opacity", "0", "important");
}

function measureHide() {
  measureHasAlt = false;
  if (measureLayer) { measureLayer.innerHTML = ""; measureLayer.style.display = "none"; }
  const hover = document.querySelector(`.${NS}-hover-box`);
  if (hover) hover.style.removeProperty("opacity");
}

function measureRectFor(els) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    minX = Math.min(minX, r.left); minY = Math.min(minY, r.top);
    maxX = Math.max(maxX, r.right); maxY = Math.max(maxY, r.bottom);
  }
  return { left: minX, top: minY, right: maxX, bottom: maxY, width: maxX - minX, height: maxY - minY };
}

function measurePlace_(el, x, y, w, h) {
  el.style.left = x + "px";
  el.style.top = y + "px";
  if (w != null) el.style.width = w + "px";
  if (h != null) el.style.height = h + "px";
}

/** Horizontal gap: red line between x1..x2 at y; px label centered above. */
function measureGapH_(layer, x1, x2, y, value) {
  if (Math.abs(x2 - x1) < 0.5) return;
  const line = measureEl_("line-h");
  measurePlace_(line, Math.min(x1, x2), y, Math.abs(x2 - x1));
  layer.appendChild(line);
  const tickA = measureEl_("tick-v");
  measurePlace_(tickA, Math.min(x1, x2), y - 3);
  const tickB = measureEl_("tick-v");
  measurePlace_(tickB, Math.max(x1, x2), y - 3);
  layer.appendChild(tickA); layer.appendChild(tickB);
  const label = measureEl_("label");
  label.textContent = Math.round(value) + "px";
  measurePlace_(label, (x1 + x2) / 2, y - 19);
  layer.appendChild(label);
}

/** Vertical gap: red line between y1..y2 at x; px label beside the line top. */
function measureGapV_(layer, y1, y2, x, value) {
  if (Math.abs(y2 - y1) < 0.5) return;
  const line = measureEl_("line-v");
  measurePlace_(line, x, Math.min(y1, y2), null, Math.abs(y2 - y1));
  layer.appendChild(line);
  const tickA = measureEl_("tick-h");
  measurePlace_(tickA, x - 3, Math.min(y1, y2));
  const tickB = measureEl_("tick-h");
  measurePlace_(tickB, x - 3, Math.max(y1, y2));
  layer.appendChild(tickA); layer.appendChild(tickB);
  const label = measureEl_("label");
  label.textContent = Math.round(value) + "px";
  measurePlace_(label, x + 9, Math.min(y1, y2) - 5);
  layer.appendChild(label);
}

function measureSchedule() {
  if (measureRaf) return;
  measureRaf = true;
  requestAnimationFrame(() => { measureRaf = false; measureRender(); });
}

function measureRender() {
  if (!measureHasAlt || minimized || paused || !measureLastPos || selectedElements.length === 0) {
    measureHide();
    return;
  }
  try {
    const layer = measureEnsureLayer();
    layer.style.display = "";
    layer.innerHTML = "";
    measureSuppressHover();

    const ref = measureRectFor(selectedElements);
    const refDim = measureEl_("label");
    refDim.textContent = `${Math.round(ref.width)} × ${Math.round(ref.height)}px`;
    measurePlace_(refDim, ref.left + ref.width / 2, ref.bottom + 6);
    layer.appendChild(refDim);

    const evt = { clientX: measureLastPos.x, clientY: measureLastPos.y, target: measureLastPos.target };
    const target = resolveTarget(resolveEventTarget(evt));
    if (!target || isEditorElement(target)) return;
    if (target === document.documentElement || target === document.body) return;
    if (selectedElements.includes(target)) return;

    const t = target.getBoundingClientRect();
    if (t.width < 1 && t.height < 1) return;

    const tbox = measureEl_("box");
    measurePlace_(tbox, t.left, t.top, t.width, t.height);
    layer.appendChild(tbox);

    const tag = (target.tagName || "").toLowerCase() + (target.id ? `#${target.id}` : "");
    const chip = measureEl_("tag");
    chip.textContent = tag;
    measurePlace_(chip, t.left + 1, t.top >= 22 ? t.top - 20 : t.top + 2);
    layer.appendChild(chip);

    const tDim = measureEl_("label");
    tDim.textContent = `${Math.round(t.width)} × ${Math.round(t.height)}px`;
    measurePlace_(tDim, t.left + t.width / 2, t.bottom + 6);
    layer.appendChild(tDim);

    const vOverlap = Math.min(ref.bottom, t.bottom) - Math.max(ref.top, t.top);
    const hOverlap = Math.min(ref.right, t.right) - Math.max(ref.left, t.left);
    const yLine = vOverlap > 0 ? Math.max(ref.top, t.top) + vOverlap / 2 : (ref.top + ref.bottom) / 2;
    const xLine = hOverlap > 0 ? Math.max(ref.left, t.left) + hOverlap / 2 : (ref.left + ref.right) / 2;

    // Left / right
    if (t.left >= ref.right) measureGapH_(layer, ref.right, t.left, yLine, t.left - ref.right);
    else if (t.right <= ref.left) measureGapH_(layer, ref.left, t.right, yLine, ref.left - t.right);
    else {
      const l = t.left - ref.left, r = ref.right - t.right;
      if (Math.abs(l) >= 1) measureGapH_(layer, ref.left, t.left, t.top + t.height / 2, Math.abs(l));
      if (Math.abs(r) >= 1) measureGapH_(layer, t.right, ref.right, t.top + t.height / 2, Math.abs(r));
    }
    // Top / bottom
    if (t.top >= ref.bottom) measureGapV_(layer, ref.bottom, t.top, xLine, t.top - ref.bottom);
    else if (t.bottom <= ref.top) measureGapV_(layer, t.bottom, ref.top, xLine, ref.top - t.bottom);
    else {
      const top = t.top - ref.top, bot = ref.bottom - t.bottom;
      if (Math.abs(top) >= 1) measureGapV_(layer, ref.top, t.top, t.left + t.width / 2, Math.abs(top));
      if (Math.abs(bot) >= 1) measureGapV_(layer, t.bottom, ref.bottom, t.left + t.width / 2, Math.abs(bot));
    }
  } catch (_) { /* fail soft: measurement must never break the picker */ }
}

setTimeout(() => {
  on(document, "mousemove", (e) => {
    measureLastPos = { x: e.clientX, y: e.clientY, target: e.target };
    const alt = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
    measureHasAlt = alt;
    measureSchedule();
  }, true);
  on(document, "keydown", (e) => {
    if (e.key === "Alt" && !e.repeat && selectedElements.length) {
      measureHasAlt = true;
      measureSchedule();
    }
  }, true);
  on(document, "click", () => {
    if (!selectedElements.length) measureHide(); else measureSchedule();
  }, true);
  on(window, "keyup", (e) => { if (e.key === "Alt") measureHide(); });
  on(window, "blur", () => measureHide());
  on(window, "scroll", () => { if (measureHasAlt) measureSchedule(); }, true);
}, 0);


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


// ── Custom select (vibe-selector extension only) ────────────
// Replaces the native <select> in the settings panel with a popover listbox
// styled like the picker's toggle rows (same radii, border, shadow, motion).
// Reuses closure helpers: NS, lang, settings, saveSettings, applyI18n,
// mountSelectorSurface. Overlay lives in the picker's popover layer, so it
// sits above every page element. Fail-soft: on any error the caller falls
// back to the native select.
(function () {
  // Click-outside + Escape close the open dropdown; registered once.
  let outsideHandler = null, escHandler = null;

  function agentSelectCloseAll(except) {
    document.querySelectorAll(`.${NS}-select-pop`).forEach((pop) => {
      if (pop === except) return;
      pop.remove();
    });
    document.querySelectorAll(`.${NS}-select-trigger`).forEach((trigger) => {
      trigger.classList.remove(`${NS}-select-open`);
      trigger.setAttribute("aria-expanded", "false");
    });
  }

  function agentEnsureDocHandlers() {
    if (outsideHandler) return;
    outsideHandler = (e) => {
      if (!e.target.closest(`.${NS}-select-pop`) && !e.target.closest(`.${NS}-select-trigger`)) agentSelectCloseAll();
    };
    escHandler = (e) => {
      if (e.key !== "Escape" || !document.querySelector(`.${NS}-select-pop`)) return;
      // The picker also handles Escape to close the entire settings panel.
      // Intercept one level earlier (window capture) so an open listbox alone
      // consumes Escape and the panel remains mounted.
      e.preventDefault();
      e.stopImmediatePropagation();
      agentSelectCloseAll();
    };
    document.addEventListener("click", outsideHandler, true);
    window.addEventListener("keydown", escHandler, true);
  }

  function agentSelectLabel(extra, opt) {
    return lang === "zh" ? (opt.labelZh || opt.labelEn || opt.value) : (opt.labelEn || opt.labelZh || opt.value);
  }

  // Builds the trigger+popover pair, mirroring mkToggle's row structure.
  function agentBuildSelect(extra, row, anchorBtn) {
    const options = extra.options || [];
    const current = () => options.find(o => o.value === settings[extra.key]) || options[0];

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = `${NS}-select-trigger`;
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const labelSpan = document.createElement("span");
    labelSpan.className = `${NS}-select-label`;
    const setCaret = () => {
      trigger.innerHTML = "";
      trigger.appendChild(labelSpan);
      const caret = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      caret.setAttribute("viewBox", "0 0 10 6");
      caret.setAttribute("class", `${NS}-select-caret`);
      caret.innerHTML = '<path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';
      trigger.appendChild(caret);
    };
    const refreshLabel = () => { labelSpan.textContent = agentSelectLabel(extra, current()); };
    setCaret(); refreshLabel();

    const pop = document.createElement("div");
    pop.className = `${NS}-select-pop`;
    pop.setAttribute("role", "listbox");

    function renderOptions() {
      pop.innerHTML = "";
      options.forEach((opt) => {
        const item = document.createElement("div");
        item.className = `${NS}-select-opt${opt.value === settings[extra.key] ? ` ${NS}-select-opt-active` : ""}`;
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", opt.value === settings[extra.key] ? "true" : "false");
        const txt = document.createElement("span");
        txt.textContent = agentSelectLabel(extra, opt);
        item.appendChild(txt);
        if (opt.value === settings[extra.key]) {
          const check = document.createElement("span");
          check.className = `${NS}-select-check`;
          check.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
          item.appendChild(check);
        }
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          if (settings[extra.key] !== opt.value) {
            settings[extra.key] = opt.value; saveSettings();
            refreshLabel();
            row.classList.remove(`${NS}-setting-flash`); void row.offsetWidth; row.classList.add(`${NS}-setting-flash`);
            applyI18n();
          }
          agentSelectCloseAll();
        });
        pop.appendChild(item);
      });
    }

    // Language and settings synchronization hook. editor-patches.js calls
    // this after the upstream applyI18n() so the visible value and an open
    // option list never retain text from the previous language.
    trigger.__agentRefreshSelect = () => {
      refreshLabel();
      if (pop.isConnected) renderOptions();
    };

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (pop.isConnected) { agentSelectCloseAll(); return; }
      agentSelectCloseAll();
      agentEnsureDocHandlers();
      renderOptions();
      // Position: anchored to the trigger, clamped to the viewport.
      const tr = trigger.getBoundingClientRect();
      pop.style.visibility = "hidden";
      mountSelectorSurface(pop);
      const pr = pop.getBoundingClientRect();
      let top = tr.bottom + 4;
      if (top + pr.height > window.innerHeight - 8) top = Math.max(8, tr.top - pr.height - 4);
      let left = Math.min(tr.right - pr.width, window.innerWidth - pr.width - 8);
      left = Math.max(8, left);
      pop.style.top = top + "px";
      pop.style.left = left + "px";
      pop.style.visibility = "";
      trigger.classList.add(`${NS}-select-open`);
      trigger.setAttribute("aria-expanded", "true");
    });

    return { trigger, pop };
  }

  // Public hook used by the patched mkExtraSelect below.
  window.__AGENT_BUILD_SELECT__ = agentBuildSelect;
})();


// ── Viewport clamping (vibe-selector extension only) ────────
// The chat panel (and its attached popovers) anchor with fixed bottom/right,
// but dragging rewrites to left/top with right/bottom set to auto. After a
// viewport SHRINK those cached pixel offsets can point off-screen and the
// panel disappears. This runs on every resize (capture phase, rAF-coalesced)
// and clamps all floating surfaces back into the visible viewport.
(function () {
  // Closure symbols from editor.js: NS, chatPanel, settingsPanel, revPanel,
  // positionAllOverlays. Guard anyway — if a future upstream rename breaks
  // this, fail soft instead of killing the whole picker.
  let clampRaf = false;
  function clampViewportPanels() {
    if (clampRaf) return;
    clampRaf = true;
    requestAnimationFrame(() => {
      clampRaf = false;
      try {
        const vw = window.innerWidth, vh = window.innerHeight;
        const surfaces = [
          [typeof chatPanel !== "undefined" ? chatPanel : null, 12],
          [typeof settingsPanel !== "undefined" ? settingsPanel : null, 8],
          [typeof revPanel !== "undefined" ? revPanel : null, 8],
        ];
        for (const [panel, margin] of surfaces) {
          if (!panel || !panel.isConnected) continue;
          const r = panel.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue; // hidden/minimized
          // Never let a panel be wider/taller than the viewport itself.
          if (r.width > vw - margin * 2 || r.height > vh - margin * 2) {
            panel.style.setProperty("max-width", (vw - margin * 2) + "px", "important");
            panel.style.setProperty("max-height", (vh - margin * 2) + "px", "important");
            panel.style.setProperty("overflow", "auto", "important");
          }
          const dx = r.right > vw - margin ? (vw - margin) - r.right : (r.left < margin ? margin - r.left : 0);
          const dy = r.bottom > vh - margin ? (vh - margin) - r.bottom : (r.top < margin ? margin - r.top : 0);
          if (!dx && !dy) continue;
          // Apply the shift via the panel's CURRENT anchor: dragged panels use
          // left/top; anchored ones use bottom/right.
          if (panel.style.left && panel.style.left !== "auto") {
            panel.style.left = Math.max(margin, r.left + dx) + "px";
            panel.style.top = Math.max(margin, r.top + dy) + "px";
          } else {
            panel.style.right = Math.max(margin, (vw - r.right) - dx) + "px";
            panel.style.bottom = Math.max(margin, (vh - r.bottom) - dy) + "px";
          }
        }
        // Overlays track page elements, not the panel — but the result panel
        // is anchored to the chat panel, so nudge it along after clamping.
        if (typeof revPanel !== "undefined" && revPanel && typeof chatPanel !== "undefined" && chatPanel) {
          const cr = chatPanel.getBoundingClientRect();
          revPanel.style.bottom = (window.innerHeight - cr.top + 8) + "px";
          revPanel.style.right = Math.max(8, window.innerWidth - cr.right) + "px";
        }
      } catch (_) { /* fail soft */ }
    });
  }
  window.addEventListener("resize", clampViewportPanels, true);
})();

// ── Custom select swap (vibe-selector extension only) ───────
// Replace the native <select> in mkExtraSelect with the styled listbox from
// select-module.js. Native select stays as fail-soft fallback.
(function () {
  if (typeof mkExtraSelect !== "function" || typeof window.__AGENT_BUILD_SELECT__ !== "function") return;
  const build = window.__AGENT_BUILD_SELECT__;
  mkExtraSelect = function (extra) {
    if (!extra || !extra.key) return null;
    const row = document.createElement("div"); row.className = `${NS}-setting-row`;
    row.dataset.settingExtra = extra.key;
    const info = document.createElement("div"); info.className = `${NS}-setting-info`;
    const labelLine = document.createElement("span"); labelLine.className = `${NS}-setting-label-line`;
    const lbl = document.createElement("span"); lbl.className = `${NS}-setting-label`; lbl.textContent = extraText(extra, "label");
    labelLine.appendChild(lbl);
    const descText = extraText(extra, "desc");
    info.appendChild(labelLine);
    if (descText) { const desc = document.createElement("span"); desc.className = `${NS}-setting-desc`; desc.textContent = descText; info.appendChild(desc); }
    row.appendChild(info);
    try {
      const { trigger } = build(extra, row, null);
      row.appendChild(trigger);
    } catch (_) {
      // Fallback: native select (original behavior).
      const select = document.createElement("select"); select.className = `${NS}-setting-select`;
      (extra.options || []).forEach(opt => {
        const o = document.createElement("option"); o.value = opt.value;
        o.textContent = lang === "zh" ? (opt.labelZh || opt.labelEn || opt.value) : (opt.labelEn || opt.labelZh || opt.value);
        if (settings[extra.key] === opt.value) o.selected = true;
        select.appendChild(o);
      });
      select.onchange = (e) => { e.stopPropagation(); settings[extra.key] = select.value; saveSettings(); applyI18n(); };
      row.appendChild(select);
    }
    return row;
  };
})();

// ── Host UI extras: language + value synchronization ────────
// Upstream refreshSettingsLabels() only knows rows backed by DICT and
// data-setting-key. HOST.uiExtras use data-setting-extra and therefore kept
// the language captured when the panel was created. Refresh those rows from
// the host descriptors after every applyI18n() call. This also synchronizes
// custom-select values after settings arrive asynchronously from the host.
(function () {
  if (typeof applyI18n !== "function") return;

  function extraOptionText(opt) {
    if (!opt) return "";
    return lang === "zh"
      ? (opt.labelZh || opt.labelEn || opt.value || "")
      : (opt.labelEn || opt.labelZh || opt.value || "");
  }

  function refreshExtraRows() {
    if (!settingsPanel || !settingsPanel.isConnected) return;
    const extras = Array.isArray(HOST.uiExtras) ? HOST.uiExtras : [];
    settingsPanel.querySelectorAll(`.${NS}-setting-row[data-setting-extra]`).forEach((row) => {
      const extra = extras.find((item) => item && item.key === row.dataset.settingExtra);
      if (!extra) return;

      const label = row.querySelector(`.${NS}-setting-label`);
      if (label) label.textContent = extraText(extra, "label");

      const info = row.querySelector(`.${NS}-setting-info`);
      let desc = row.querySelector(`.${NS}-setting-desc`);
      const descText = extraText(extra, "desc");
      if (descText) {
        if (!desc && info) {
          desc = document.createElement("span");
          desc.className = `${NS}-setting-desc`;
          info.appendChild(desc);
        }
        if (desc) desc.textContent = descText;
      } else if (desc) {
        desc.remove();
      }

      const trigger = row.querySelector(`.${NS}-select-trigger`);
      if (trigger && typeof trigger.__agentRefreshSelect === "function") {
        trigger.__agentRefreshSelect();
      }

      // Native fallback remains fully localized too.
      const select = row.querySelector("select");
      if (select) {
        const options = Array.isArray(extra.options) ? extra.options : [];
        Array.from(select.options).forEach((node, index) => {
          node.textContent = extraOptionText(options[index]);
        });
        if (settings[extra.key] != null) select.value = settings[extra.key];
      }
    });
  }

  const originalApplyI18n = applyI18n;
  applyI18n = function () {
    const result = originalApplyI18n.apply(this, arguments);
    try { refreshExtraRows(); } catch (_) { /* fail soft */ }
    return result;
  };
  window.__AGENT_REFRESH_EXTRA_ROWS__ = refreshExtraRows;
})();

// ── Settings shortcut display uses <kbd> key-caps (vibe-selector) ──
// The root panel renders shortcut hints as <kbd>AgentEditorShortcuts kbd>
// key-caps; the settings panel showed plain text so the same ⌘⇧C looked
// different. Wrap the record button's text and the activation shortcut in
// <kbd> for visual consistency. Re-binding a function declaration inside the
// closure is safe: call sites run after init().
(function () {
  function agentKbd(text) {
    const k = document.createElement("kbd");
    k.className = `${NS}-kbd-cap`;
    k.textContent = text;
    return k;
  }
  function agentIsMac() {
    return /Mac|iPhone|iPad|iPod/i.test((navigator && navigator.platform) || "");
  }
  // Split "⌘⇧C" / "Ctrl+Shift+C" into per-key caps separated by thin gaps.
  function agentKbdGroup(combo) {
    const frag = document.createDocumentFragment();
    const isMac = agentIsMac();
    const keys = isMac ? String(combo).split("") : String(combo).split("+");
    keys.forEach((key, i) => {
      if (!key) return;
      if (i > 0) {
        const sep = document.createElement("span");
        sep.className = `${NS}-kbd-plus`;
        sep.textContent = isMac ? "" : "+";
        frag.appendChild(sep);
      }
      frag.appendChild(agentKbd(key));
    });
    return frag;
  }
  window.__AGENT_KBD_GROUP__ = agentKbdGroup;

  // Patch mkShortcutRow: replace textContent rendering with kbd caps and keep
  // them in sync on record/clear/blur.
  if (typeof mkShortcutRow === "function") {
    const _orig = mkShortcutRow;
    mkShortcutRow = function (key) {
      const row = _orig(key);
      try {
        const button = row.querySelector(`.${NS}-shortcut-record`);
        if (!button) return row;
        const render = () => {
          if (button.dataset.recording) return;
          const value = (typeof settings !== "undefined" && settings[key]) || "";
          button.textContent = "";
          if (value && typeof formatPageShortcut === "function") {
            button.appendChild(agentKbdGroup(formatPageShortcut(value)));
          } else {
            button.textContent = value || (typeof t === "function" ? t("shortcutCleared") : "");
          }
        };
        render();
        // Re-render after recording interactions (keydown/focus/blur mutate textContent).
        button.addEventListener("focus", () => setTimeout(render, 0));
        button.addEventListener("blur", () => setTimeout(render, 0));
        button.addEventListener("keydown", () => setTimeout(render, 0));
      } catch (_) {}
      return row;
    };
  }

  // refreshShortcutRows() rewrites button.textContent during language changes.
  // Re-apply key-cap markup after upstream refresh while preserving the
  // recording hint for whichever button currently has focus.
  if (typeof refreshShortcutRows === "function") {
    const _origRefreshRows = refreshShortcutRows;
    refreshShortcutRows = function () {
      const result = _origRefreshRows.apply(this, arguments);
      try {
        if (!settingsPanel) return result;
        settingsPanel.querySelectorAll(`.${NS}-shortcut-row[data-shortcut-key]`).forEach((row) => {
          const button = row.querySelector(`.${NS}-shortcut-record`);
          if (!button || button.dataset.recording) return;
          const value = settings[row.dataset.shortcutKey] || "";
          button.textContent = "";
          if (value) button.appendChild(agentKbdGroup(formatPageShortcut(value)));
          else button.textContent = formatPageShortcut("");
        });
      } catch (_) {}
      return result;
    };
  }

  // Patch the activation shortcut display (Pro/Plus summary row).
  if (typeof refreshProSettingsSummary === "function") {
    const _origRefresh = refreshProSettingsSummary;
    refreshProSettingsSummary = function () {
      const r = _origRefresh();
      try {
        const shortcut = settingsPanel && settingsPanel.querySelector(`.${NS}-settings-shortcut-current`);
        if (shortcut && typeof HOST !== "undefined" && HOST.activationShortcut && typeof formatActivationShortcut === "function") {
          shortcut.textContent = "";
          shortcut.appendChild(agentKbdGroup(formatActivationShortcut(HOST.activationShortcut)));
        }
      } catch (_) {}
      return r;
    };
  }
})();

// ── Settings panel: drag-follow + el-scrollbar (vibe-selector) ──
// 1) The settings panel anchors to the chat panel at open time; while the
//    chat panel is dragged, recompute that anchor. The listen target is the
//    DOCUMENT (capture) because upstream drag listens there too — listening
//    on the handle never fires for document-dispatched moves.
// 2) Rows live in an el-scrollbar-style area: native scrollbar hidden, thin
//    rounded thumb inside a track that is a SIBLING of the scroller (so it
//    never scrolls away), visible on hover or while scrolling, draggable.
(function () {
  if (typeof makeDraggable !== "function") return;

  function clampPanelIntoViewport(panel, margin) {
    const r = panel.getBoundingClientRect();
    const vh = window.innerHeight, vw = window.innerWidth;
    panel.style.setProperty("max-height", (vh - margin * 2) + "px", "important");
    if (r.bottom > vh - margin) {
      const dy = (vh - margin) - r.bottom;
      panel.style.bottom = Math.max(margin, (vh - r.bottom) - dy) + "px";
    }
    if (r.top < margin) panel.style.bottom = Math.max(margin, (vh - margin) - r.height) + "px";
    if (r.right > vw - margin) panel.style.right = margin + "px";
    if (r.left < margin) panel.style.right = Math.max(margin, vw - margin - r.width) + "px";
  }

  const _origMakeDraggable = makeDraggable;
  makeDraggable = function (panel, handle) {
    _origMakeDraggable(panel, handle);
    if (panel !== chatPanel) return;
    // Upstream drag mutates the chat panel in a document-level BUBBLE
    // listener; a capture-phase reader on the same event would measure the
    // PRE-move position. Coalesce through rAF so the anchor math always runs
    // after upstream's move, and re-run once more on mouseup (the final
    // position lands there when the drag ends between moves).
    let followRaf = false;
    const follow = () => {
      if (followRaf) return;
      followRaf = true;
      requestAnimationFrame(() => {
        followRaf = false;
        try {
          if (typeof settingsOpen === "undefined" || !settingsOpen) return;
          if (!settingsPanel || !settingsPanel.isConnected || !chatPanel) return;
          const cr = chatPanel.getBoundingClientRect();
          settingsPanel.style.bottom = (window.innerHeight - cr.top + 4) + "px";
          settingsPanel.style.right = Math.max(8, window.innerWidth - cr.right) + "px";
          clampPanelIntoViewport(settingsPanel, 8);
        } catch (_) {}
      });
    };
    document.addEventListener("mousemove", follow, true);
    document.addEventListener("mouseup", follow, true);
  };

  if (typeof createSettingsPanel === "function") {
    const _origCreate = createSettingsPanel;
    createSettingsPanel = function () {
      _origCreate();
      try {
        if (!settingsPanel) return;
        const header = settingsPanel.querySelector(`.${NS}-settings-header`);
        const kids = Array.from(settingsPanel.children).filter(k => k !== header);
        const wrapEl = document.createElement("div"); wrapEl.className = `${NS}-scrollwrap`;
        const scroller = document.createElement("div"); scroller.className = `${NS}-scroll`;
        const bar = document.createElement("div"); bar.className = `${NS}-scroll-bar`;
        const thumb = document.createElement("div"); thumb.className = `${NS}-scroll-bar-thumb`;
        bar.appendChild(thumb);
        wrapEl.appendChild(scroller);
        wrapEl.appendChild(bar);
        kids.forEach(k => scroller.appendChild(k));
        settingsPanel.appendChild(wrapEl);

        const sync = () => {
          const { scrollHeight, clientHeight, scrollTop } = scroller;
          if (scrollHeight <= clientHeight + 1) { thumb.style.height = "0px"; return; }
          const trackH = clientHeight - 8;
          const h = Math.max(24, Math.round((clientHeight / scrollHeight) * trackH));
          const y = 4 + (scrollTop / (scrollHeight - clientHeight)) * (trackH - h);
          thumb.style.height = h + "px";
          thumb.style.transform = `translateY(${Math.round(y)}px)`;
        };
        let scrollTimer = null;
        scroller.addEventListener("scroll", () => {
          wrapEl.classList.add(`${NS}-scrolling`);
          if (scrollTimer) clearTimeout(scrollTimer);
          scrollTimer = setTimeout(() => wrapEl.classList.remove(`${NS}-scrolling`), 600);
          sync();
        }, { passive: true });
        setTimeout(sync, 0);
        if (typeof ResizeObserver === "function") new ResizeObserver(sync).observe(scroller);
        window.addEventListener("resize", sync, true);

        // Drag the thumb to scroll (thumb must receive pointer events even
        // though the track itself is click-through).
        thumb.addEventListener("pointerdown", (e) => {
          e.preventDefault(); e.stopPropagation();
          const startY = e.clientY, startTop = scroller.scrollTop;
          const move = (ev) => {
            const { scrollHeight, clientHeight } = scroller;
            if (scrollHeight <= clientHeight) return;
            const trackH = clientHeight - 8;
            const h = Math.max(24, Math.round((clientHeight / scrollHeight) * trackH));
            const dy = ev.clientY - startY;
            scroller.scrollTop = startTop + (dy / Math.max(1, trackH - h)) * (scrollHeight - clientHeight);
          };
          const up = () => {
            document.removeEventListener("pointermove", move, true);
            document.removeEventListener("pointerup", up, true);
          };
          document.addEventListener("pointermove", move, true);
          document.addEventListener("pointerup", up, true);
        });

        clampPanelIntoViewport(settingsPanel, 8);
      } catch (_) {}
    };
  }
})();

  // ── Boot ───────────────────────────────────────────────────
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

