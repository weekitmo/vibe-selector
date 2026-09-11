/**
 * Vibe Selector — MAIN-world HOST adapter.
 *
 * The picker (picker/editor.js) is a closed IIFE that reads
 * window.__SELECTOR_HOST__ at boot. Every optional capability it knows how to
 * ask for is implemented here; anything left absent falls back to the
 * picker's built-in no-host behaviour.
 */
(function () {
  if (window.__SELECTOR_HOST__) return; // already installed

  // ── MAIN → ISOLATED RPC (bridge in content/shim.js) ───────
  const RPC_REQ = "vibe-rpc-request";
  const RPC_RES = "vibe-rpc-response";
  let rpcSeq = 0;
  const rpcPending = new Map();

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.type !== RPC_RES) return;
    const entry = rpcPending.get(msg.id);
    if (!entry) return;
    rpcPending.delete(msg.id);
    msg.ok ? entry.resolve(msg.data) : entry.reject(new Error(msg.error && msg.error.message || "rpc failed"));
  });

  function rpc(method, params) {
    const id = ++rpcSeq;
    return new Promise((resolve, reject) => {
      rpcPending.set(id, { resolve, reject });
      window.postMessage({ type: RPC_REQ, id, method, params }, window.location.origin);
      setTimeout(() => {
        if (rpcPending.has(id)) {
          rpcPending.delete(id);
          reject(new Error("rpc timeout: " + method));
        }
      }, 30000);
    });
  }

const EXT_SETTINGS_DEFAULTS = {
    combined: false,
    sharingan: false,
    // extension-only extras surfaced in the picker's settings panel (uiExtras)
    autoSaveScreenshots: false,
    screenshotScope: "viewport",       // "viewport" | "fullElement" | "fullPage"
    inlineCrossOrigin: true,
    // recordable page shortcuts
    shortcutCopyContext: "Mod+C",
    shortcutScreenshotContext: "Mod+Shift+C",
    shortcutMarkdown: "Mod+M",
  };

  let settings = Object.assign({}, EXT_SETTINGS_DEFAULTS);
  let lang = /^[a-z]{2}\b/i.test(navigator.language || "") && /^zh\b/i.test(navigator.language || "") ? "zh" : (/^zh\b/i.test(navigator.language || "") ? "zh" : "en");
  let activationShortcut = "";

  function persistSettings(next) {
    settings = Object.assign({}, settings, next);
    rpc("settings.set", { settings }).catch(() => {});
  }

  // ── Cross-origin resource caches (Sharingan fidelity) ──────
  const assetCache = new Map();   // absolute URL → dataURL
  const cssTextCache = new Map(); // absolute stylesheet href → raw text
  const cssRulesCache = new Map(); // absolute stylesheet href → CSSRuleList
  const fontCache = new Map();    // absolute font URL → dataURL

  function absolute(url, base) {
    try { return new URL(url, base || document.baseURI).href; } catch (_) { return url; }
  }

  function collectElementUrls(selector, attr) {
    const urls = [];
    try {
      document.querySelectorAll(selector).forEach((el) => {
        const v = el.getAttribute(attr);
        if (v) urls.push(v);
      });
    } catch (_) {}
    return urls;
  }

  function collectImgUrls(elements) {
    const urls = new Set();
    const add = (raw, base) => {
      if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return;
      urls.add(absolute(raw, base));
    };
    for (const root of elements || []) {
      if (!root || root.querySelectorAll) { /* may be document */ }
      const scopes = root && root.querySelectorAll ? [root] : [];
      if (!root) continue;
      for (const scope of scopes.length ? scopes : []) {
        scope.querySelectorAll("img[src], img[srcset], source[srcset]").forEach((img) => {
          const src = img.getAttribute("src"); if (src) add(src, scope.baseURI);
          const srcset = img.getAttribute("srcset");
          if (srcset) {
            srcset.split(",").forEach((part) => {
              const u = part.trim().split(/\s+/)[0];
              if (u) add(u, scope.baseURI);
            });
          }
        });
        // background-image url(...) tokens from computed styles
        scope.querySelectorAll("*").forEach((el) => {
          const bg = getComputedStyle(el).backgroundImage || "";
          const re = /url\((?:"|')?([^'")]+)(?:"|')?\)/g;
          let m;
          while ((m = re.exec(bg))) add(m[1], document.baseURI);
        });
      }
    }
    return Array.from(urls);
  }

  function collectSheetHrefs() {
    const hrefs = new Set();
    for (const sheet of Array.from(document.styleSheets || [])) {
      let accessible = true;
      try { void sheet.cssRules; } catch (_) { accessible = false; }
      if (!accessible && sheet.href) hrefs.add(sheet.href);
    }
    return Array.from(hrefs);
  }

  function collectFontUrls(elements) {
    const urls = new Set();
    const fontFaceBlocks = [];
    for (const sheet of Array.from(document.styleSheets || [])) {
      let rules = null;
      try { rules = sheet.cssRules; } catch (_) { rules = cssRulesCache.get(sheet.href) || null; }
      if (!rules) continue;
      for (const rule of Array.from(rules)) {
        if (rule.type === 5 /* FONT_FACE */ || (rule.cssText || "").startsWith("@font-face")) {
          fontFaceBlocks.push({ rule, base: sheet.href || document.baseURI });
        }
      }
    }
    for (const { rule, base } of fontFaceBlocks) {
      const cssText = rule.cssText || "";
      const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
      let m;
      while ((m = re.exec(cssText))) {
        const raw = (m[2] || "").trim();
        if (!raw || raw.startsWith("data:")) continue;
        urls.add(absolute(raw, base));
      }
    }
    return Array.from(urls);
  }

  async function prepareAssets(elements) {
    const urls = collectImgUrls(elements && elements.length ? elements : null);
    if (!urls.length) return { count: 0 };
    const results = await rpc("assets.fetchMany", { urls }).catch(() => ({ items: [] }));
    for (const item of (results && results.items) || []) {
      if (item && item.url && item.dataUrl) assetCache.set(item.url, item.dataUrl);
    }
    return { count: assetCache.size };
  }

  async function prepareStyles(elements) {
    // 1. cross-origin stylesheets → raw text (+ parse into CSSStyleSheet for
    //    the sync rules cache)
    const hrefs = collectSheetHrefs();
    const fontUrls = collectFontUrls(null);
    const payload = await rpc("assets.fetchStyles", { hrefs, fontUrls }).catch(() => ({ sheets: [], fonts: [] }));
    for (const sheet of (payload && payload.sheets) || []) {
      if (!sheet || !sheet.href || typeof sheet.text !== "string") continue;
      cssTextCache.set(sheet.href, sheet.text);
      try {
        const parsed = new CSSStyleSheet();
        // Main-world construction inherits this page's base for relative URLs.
        await parsed.replace(sheet.text);
        cssRulesCache.set(sheet.href, parsed.cssRules);
      } catch (_) { /* replace() can reject on malformed CSS; cache text only */ }
    }
    for (const font of (payload && payload.fonts) || []) {
      if (font && font.url && font.dataUrl) fontCache.set(font.url, font.dataUrl);
    }
  }

  // ── Screenshots ─────────────────────────────────────────────
  async function grabViewportFrame() {
    const { dataUrl } = await rpc("capture.visibleTab", {});
    const img = new Image();
    img.decoding = "sync";
    const loaded = new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("capture frame decode failed"));
    });
    img.src = dataUrl;
    await loaded;
    return img;
  }

  /**
   * Scroll-and-stitch capture for fullPage / fullElement scopes.
   * geom comes from the picker (document coords, CSS px):
   *   { x, y, w, h, dpr, pageWidth }
   * Strategy: for regions inside the current viewport, one visible-tab shot
   * cropped with CSS→physical math is enough. For taller regions, scroll the
   * window through the band, capture each stop, and stitch.
   */
  async function captureRegion(scope, geom) {
    const dpr = geom.dpr || window.devicePixelRatio || 1;
    const viewportH = window.innerHeight;
    // Everything happens in document space; the browser clamps scrollTo, so
    // record where each frame ACTUALLY landed via the live scroll offsets.
    const stops = buildStops(geom.y, geom.h, viewportH);
    const frames = [];
    const originalX = window.scrollX, originalY = window.scrollY;
    try {
      for (const stop of stops) {
        window.scrollTo(stop.x, stop.y);
        await settle();
        const landedX = window.scrollX, landedY = window.scrollY;
        const shot = await grabViewportFrame();
        frames.push({ shot, docY: landedY, docX: landedX });
      }
    } finally {
      window.scrollTo(originalX, originalY);
      await settle();
    }
    return stitch(frames, geom, dpr);
  }

  function buildStops(y, h, viewportH) {
    // One stop per viewport band; scrollTo clamps at the page bottom, which
    // the "landed" capture records honestly (the stitcher skips empty bands).
    const stops = [];
    const x = 0; // horizontal origin; wide pages crop from this column
    let cursor = y;
    while (cursor < y + h) {
      stops.push({ x, y: Math.round(cursor) });
      cursor += viewportH;
    }
    if (!stops.length) stops.push({ x, y });
    return stops;
  }

  function settle() {
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 60))));
  }

  function stitch(frames, geom, dpr) {
    const outW = Math.round(geom.w * dpr);
    const outH = Math.round(geom.h * dpr);
    const canvas = document.createElement("canvas");
    canvas.width = outW; canvas.height = outH;
    const ctx = canvas.getContext("2d");
    for (const frame of frames) {
      const shot = frame.shot;
      const srcW = shot.naturalWidth, srcH = shot.naturalHeight;
      // Visible document Y range of this frame = [landedY, landedY + viewportHeight].
      // captureVisibleTab returns the visual viewport; innerHeight is the CSS
      // height of that viewport, so frameDocH = srcW / dpr is NOT used — we
      // trust innerHeight as the picker's geometry math already does.
      const frameDocY = frame.docY;
      const frameDocH = window.innerHeight;
      const bandTop = Math.max(geom.y, frameDocY);
      const bandBottom = Math.min(geom.y + geom.h, frameDocY + frameDocH);
      if (bandBottom <= bandTop) continue;
      const sx = Math.round((geom.x - frame.docX) * dpr);
      const sy = Math.round((bandTop - frameDocY) * dpr);
      const sw = Math.max(1, Math.round(geom.w * dpr));
      const sh = Math.max(1, Math.round((bandBottom - bandTop) * dpr));
      // Clamp to the actual frame size (dpr rounding can overshoot by 1px).
      const cropW = Math.min(sw, srcW - sx);
      const cropH = Math.min(sh, srcH - sy);
      if (cropW <= 0 || cropH <= 0) continue;
      const dx = 0;
      const dy = Math.round((bandTop - geom.y) * dpr);
      ctx.drawImage(shot, sx, sy, cropW, cropH, dx, dy, cropW, cropH);
    }
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  // ── Downloads ───────────────────────────────────────────────
  async function downloadFile(filename, blob, mime) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("read failed"));
      reader.readAsDataURL(blob);
    });
    return rpc("downloads.save", { filename, dataUrl, mime });
  }

  // ── Boot: load settings + shortcuts from storage ───────────
  async function boot() {
    try {
      const info = await rpc("session.boot", {});
      if (info && info.settings) settings = Object.assign({}, EXT_SETTINGS_DEFAULTS, info.settings);
      if (info && info.lang) lang = info.lang;
      if (info && info.shortcuts && info.shortcuts["_execute_action"]) {
        activationShortcut = info.shortcuts["_execute_action"];
      }
    } catch (_) { /* defaults are fine */ }
  }

  const host = {
    isExtension: true,
    pageShortcuts: true,
    get initialSettings() { return settings; },
    get initialLang() { return lang; },
    get activationShortcut() { return activationShortcut; },
    imageInlinePixelLimit: 4_000_000,
    autoSaveScreenshots: false,
    screenshotClipboardContext: true,
    setSettings(next) { persistSettings(next); },
    setLang(next) { settings.lang = next; persistSettings({ lang: next }); },
    openShortcutSettings() { rpc("app.openShortcuts", {}).catch(() => {}); },
    grabViewportFrame,
    captureRegion,
    prepareAssets,
    prepareStyles,
    cachedAssetDataURL(url) { return assetCache.get(String(url)) || null; },
    cachedStylesheetRules(href) { return cssRulesCache.get(String(href)) || null; },
    cachedFontDataURL(url) { return fontCache.get(String(url)) || null; },
    downloadFile,
    onClosed() { rpc("session.close", {}).catch(() => {}); },
    uiExtras: [
      {
        key: "screenshotScope",
        type: "select",
        labelEn: "Screenshot scope",
        labelZh: "截图范围",
        descEn: "Viewport, whole element, or full page",
        descZh: "视口、整个元素或整页",
        options: [
          { value: "viewport", labelEn: "Selection area", labelZh: "选中区域" },
          { value: "fullElement", labelEn: "Full element", labelZh: "整个元素" },
          { value: "fullPage", labelEn: "Full page", labelZh: "整页" },
        ],
      },
      {
        key: "autoSaveScreenshots",
        type: "toggle",
        labelEn: "Auto-save PNG",
        labelZh: "自动保存 PNG",
        descEn: "Save the screenshot with every copy",
        descZh: "每次复制时同时保存 PNG 文件",
      },
      {
        key: "inlineCrossOrigin",
        type: "toggle",
        labelEn: "Inline cross-origin assets",
        labelZh: "内联跨域资源",
        descEn: "Fetch remote images, CSS and fonts for Mirror reports",
        descZh: "为镜像报告抓取远程图片、样式与字体",
      },
    ],
  };

  // ── SW-driven toggle / action events from the shim ─────────
  window.addEventListener("vibe:toggle", () => {
    // The SW only sends this when sticky state says we are active; ask the
    // picker to destroy via its public hook.
    if (typeof window.__SELECTOR_DESTROY__ === "function") {
      window.__SELECTOR_DESTROY__();
      if (host.onClosed) host.onClosed();
    }
  });

  // SPA same-document navigation: keep the picker alive but reset page
  // specific state via the picker's reset hook (selection, panels, overlays).
  window.addEventListener("vibe:navigation", () => {
    if (typeof window.__SELECTOR_ON_NAVIGATION__ === "function") {
      try { window.__SELECTOR_ON_NAVIGATION__(); } catch (_) {}
    }
  });

  // The picker reads initialSettings/initialLang ONCE at IIFE evaluation, but
  // chrome.storage is async and the picker payload is a synchronous IIFE.
  // The ISOLATED shim therefore mirrors synced settings into sessionStorage
  // right before the SW injects the MAIN payload; that read is synchronous.
  function readMirror() {
    try {
      const raw = sessionStorage.getItem("vibe-host-mirror");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.settings) settings = Object.assign({}, EXT_SETTINGS_DEFAULTS, data.settings);
      if (data.lang === "en" || data.lang === "zh") lang = data.lang;
      if (data.activationShortcut) activationShortcut = data.activationShortcut;
    } catch (_) {}
  }
  readMirror();

  // Async reconcile after boot: update activationShortcut etc. (initial values
  // were already consumed by the picker; settings CHANGES still propagate via
  // __SELECTOR_APPLY_SETTINGS__ which the picker registers at init).
  boot().then((info) => {
    if (info && info.shortcuts && info.shortcuts["_execute_action"]) {
      const next = info.shortcuts["_execute_action"];
      if (next !== activationShortcut) {
        activationShortcut = next;
        if (typeof window.__SELECTOR_APPLY_SETTINGS__ === "function") {
          try { window.__SELECTOR_APPLY_SETTINGS__({}); } catch (_) {}
        }
      }
    }
  }).catch(() => {});

  window.__VIBE_HOST_READY__ = boot();
  window.__SELECTOR_HOST__ = host;
})();
