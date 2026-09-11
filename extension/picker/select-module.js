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
    // this after the built-in applyI18n() so the visible value and an open
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
