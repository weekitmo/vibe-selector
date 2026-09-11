// ── Viewport clamping (vibe-selector extension only) ────────
// The chat panel (and its attached popovers) anchor with fixed bottom/right,
// but dragging rewrites to left/top with right/bottom set to auto. After a
// viewport SHRINK those cached pixel offsets can point off-screen and the
// panel disappears. This runs on every resize (capture phase, rAF-coalesced)
// and clamps all floating surfaces back into the visible viewport.
(function () {
  // Closure symbols from editor.js: NS, chatPanel, settingsPanel, revPanel,
  // positionAllOverlays. Guard anyway — if a future rename breaks
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
// The built-in refreshSettingsLabels() only knows rows backed by DICT and
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
  // Re-apply key-cap markup after the built-in refresh while preserving the
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
//    DOCUMENT (capture) because the built-in drag listens there too — listening
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
    // The built-in drag mutates the chat panel in a document-level BUBBLE
    // listener; a capture-phase reader on the same event would measure the
    // PRE-move position. Coalesce through rAF so the anchor math always runs
    // after the built-in move, and re-run once more on mouseup (the final
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
