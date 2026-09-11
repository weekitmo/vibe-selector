/**
 * Vibe Selector — MV3 service worker.
 *
 * Responsibilities:
 *  - JSON-RPC bridge for the MAIN-world picker (chrome.* APIs are extension-
 *    world only; the picker talks to us through the ISOLATED shim).
 *  - Screenshot capture: chrome.tabs.captureVisibleTab, plus full-page /
 *    full-element capture by scroll-and-stitch when the picker asks for it.
 *  - File downloads via chrome.downloads (returns the real on-disk path).
 *  - Session stickiness: remember which tabs have the picker active so it can
 *    survive reloads and SPA navigations (content script re-injects itself).
 *  - Per-action shortcut dispatch (chrome.commands) → forward to active tab.
 *  - contextMenus entries for the picker.
 */

const PICKER_FILE = "picker/editor.js";
const STICKY_KEY = "vibe-sticky-tabs";
// How long a tab keeps "picker open" state without a heartbeat (ms). This is a
// crash backstop, not the normal off path — closing the picker explicitly
// clears the flag immediately.
const STICKY_TTL_MS = 6 * 60 * 60 * 1000;

// ── Sticky tab registry (chrome.storage.session, survives SW restarts) ──
async function stickyGet() {
  try {
    const o = await chrome.storage.session.get(STICKY_KEY);
    const map = (o && o[STICKY_KEY]) || {};
    // Opportunistic GC of expired entries.
    const now = Date.now();
    let changed = false;
    for (const tabId of Object.keys(map)) {
      if (now - map[tabId].at > STICKY_TTL_MS) { delete map[tabId]; changed = true; }
    }
    if (changed) await chrome.storage.session.set({ [STICKY_KEY]: map });
    return map;
  } catch (_) { return {}; }
}
async function stickySet(tabId, entry) {
  const map = await stickyGet();
  if (entry) map[tabId] = entry; else delete map[tabId];
  await chrome.storage.session.set({ [STICKY_KEY]: map });
}
async function stickyIsActive(tabId) {
  const map = await stickyGet();
  const e = map[tabId];
  return !!(e && Date.now() - e.at <= STICKY_TTL_MS);
}

// ── Script injection ─────────────────────────────────────────
async function injectPicker(tabId) {
  // ISOLATED shim first: it owns the RPC channel, SW→page action forwarding,
  // and (critically) refreshes the sessionStorage mirror of synced settings
  // that the MAIN-world host adapter reads synchronously at eval time.
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    files: ["content/shim.js"],
  });
  // Give the shim's session.boot roundtrip a beat so the sessionStorage mirror
  // is fresh before the MAIN world reads it. Only paid on activation.
  await new Promise(r => setTimeout(r, 150));
  // MAIN world payload in strict order: HOST adapter → picker IIFE → shortcut
  // bridge. The picker reads window.__SELECTOR_HOST__ once at evaluation, so
  // the adapter MUST come first; editor.js self-initializes when evaluated;
  // inject.js only dispatches vibe:action events and must come LAST.
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    world: "MAIN",
    files: ["picker/host-adapter.js", PICKER_FILE, "picker/inject.js"],
  });
  // Editor CSS into ISOLATED world (content scripts can inject CSS without
  // crossing the world boundary; styles are document-global anyway).
  await chrome.scripting.insertCSS({
    target: { tabId, allFrames: false },
    files: ["picker/editor.css"],
  });
}

// ── RPC handling ─────────────────────────────────────────────
// Message envelope from the shim: { type:"vibe-rpc", id, method, params }.
// Replies travel back as { type:"vibe-rpc-reply", id, ok, data|error }.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "vibe-rpc") return false;
  handleRpc(msg.method, msg.params, sender)
    .then(data => sendResponse({ type: "vibe-rpc-reply", id: msg.id, ok: true, data }))
    .catch(err => sendResponse({
      type: "vibe-rpc-reply", id: msg.id, ok: false,
      error: { message: String((err && err.message) || err), name: (err && err.name) || "Error" },
    }));
  return true; // async sendResponse
});

async function handleRpc(method, params, sender) {
  const tabId = sender.tab && sender.tab.id;
  // captureVisibleTab is window-scoped — it needs the WINDOW id, not the tab id.
  const windowId = sender.tab && sender.tab.windowId;
  switch (method) {
    case "session.boot":       return rpcBoot(tabId);
    case "settings.set":       return rpcSettingsSet(params);
    case "capture.visibleTab": return rpcCaptureVisibleTab(windowId);
    case "downloads.save":     return rpcDownloadSave(params);
    case "session.heartbeat":  return rpcHeartbeat(tabId, params);
    case "session.close":      return rpcClose(tabId);
    case "session.getState":   return rpcGetState(tabId);
    case "shortcuts.getAll":   return rpcShortcutsGetAll();
    case "assets.fetchMany":   return rpcFetchAssets(params);
    case "assets.fetchStyles": return rpcFetchStyles(params);
    case "app.openShortcuts":  return rpcOpenShortcuts();
    default: throw new Error(`Unknown RPC method: ${method}`);
  }
}

// ── Synced settings (chrome.storage.sync) ──────────────────
const SETTINGS_KEY = "vibe-settings";
const LANG_KEY = "vibe-lang";

async function rpcBoot(tabId) {
  const [settings, lang, commands] = await Promise.all([
    chrome.storage.sync.get(SETTINGS_KEY).then(o => o[SETTINGS_KEY] || {}),
    chrome.storage.sync.get(LANG_KEY).then(o => o[LANG_KEY] || ""),
    chrome.commands.getAll(),
  ]);
  const map = {};
  for (const c of commands) if (c.name && c.shortcut) map[c.name] = c.shortcut;
  return { settings, lang, shortcuts: map };
}

async function rpcSettingsSet(params) {
  const s = (params && params.settings) || {};
  // Language lives beside the other settings (host sends the whole object).
  const lang = s.lang || "";
  const rest = Object.assign({}, s);
  delete rest.lang;
  await chrome.storage.sync.set({ [SETTINGS_KEY]: rest });
  if (lang) await chrome.storage.sync.set({ [LANG_KEY]: lang });
  return { ok: true };
}

// ── Screenshots ──────────────────────────────────────────────
async function rpcCaptureVisibleTab(tabId) {
  const dataUrl = await chrome.tabs.captureVisibleTab(tabId, { format: "png" });
  return { dataUrl };
}

// ── Cross-origin asset prefetch (Sharingan fidelity) ────────
// The MAIN-world Sharingan pipeline is synchronous, so cross-origin reads are
// pre-warmed here (extension world ignores page CORS for declared hosts) and
// consumed later through the sync cached* lookups on the host object.
async function rpcFetchAssets(params) {
  const urls = Array.isArray(params && params.urls) ? params.urls.slice(0, 200) : [];
  const items = await Promise.all(urls.map(async (url) => {
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (blob.size > 8 * 1024 * 1024) return null;
      const dataUrl = await blobToDataUrl(blob);
      return { url, dataUrl };
    } catch (_) { return null; }
  }));
  return { items: items.filter(Boolean) };
}

async function rpcFetchStyles(params) {
  const hrefs = Array.isArray(params && params.hrefs) ? params.hrefs.slice(0, 100) : [];
  const fontUrls = Array.isArray(params && params.fontUrls) ? params.fontUrls.slice(0, 150) : [];
  const [sheets, fonts] = await Promise.all([
    Promise.all(hrefs.map(async (href) => {
      try {
        const res = await fetch(href, { credentials: "include" });
        if (!res.ok) return null;
        const text = await res.text();
        if (text.length > 6 * 1024 * 1024) return null;
        return { href, text };
      } catch (_) { return null; }
    })),
    rpcFetchAssets({ urls: fontUrls }),
  ]);
  return { sheets: sheets.filter(Boolean), fonts: (fonts && fonts.items) || [] };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

// (capture.region lives in the MAIN-world host adapter: it scrolls the page
// itself and calls capture.visibleTab once per stop, then stitches. No SW-side
// region logic needed.)

// ── Downloads ────────────────────────────────────────────────
async function rpcDownloadSave(params) {
  const { filename, dataUrl, blob } = params || {};
  const url = dataUrl || blob;
  if (!url) throw new Error("downloads.save requires dataUrl");
  const filenameSafe = sanitizeFilename(filename || `vibe-selector-${Date.now()}.png`);
  const id = await chrome.downloads.download({ url, filename: filenameSafe, saveAs: false });
  // onDeterminingFilename would give the final path, but it needs a persistent
  // listener; instead resolve the path from the DownloadItem after it starts.
  const path = await resolveDownloadPath(id);
  return { id, path };
}

function sanitizeFilename(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, "_").replace(/^\.+/, "").slice(0, 180) || "download";
}

async function resolveDownloadPath(id) {
  // Poll briefly for the download to leave the "in_progress" state so we can
  // report the actual absolute path (best-effort — the AI just needs a locator).
  for (let i = 0; i < 40; i++) {
    const items = await chrome.downloads.search({ id });
    const item = items && items[0];
    if (item && !item.filename) { /* not yet determined */ }
    if (item && item.filename && item.state !== "in_progress") {
      return item.filename;
    }
    if (item && (item.state === "interrupted" || item.state === "complete")) {
      return item.filename || "";
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return "";
}

// ── Sticky session ───────────────────────────────────────────
async function rpcHeartbeat(tabId, params) {
  await stickySet(tabId, { at: Date.now(), open: !!(params && params.open) });
  return { ok: true };
}
async function rpcClose(tabId) {
  await stickySet(tabId, null);
  return { ok: true };
}
async function rpcGetState(tabId) {
  return { active: await stickyIsActive(tabId) };
}

// ── Shortcuts ────────────────────────────────────────────────
// Registered commands are returned at boot; kept for compatibility.
async function rpcShortcutsGetAll() {
  const commands = await chrome.commands.getAll();
  const map = {};
  for (const c of commands) if (c.name && c.shortcut) map[c.name] = c.shortcut;
  return { map };
}
async function rpcOpenShortcuts() {
  await chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  return { ok: true };
}

// ── Action + commands + menus ───────────────────────────────
async function togglePicker(tab) {
  if (!tab || !tab.id || tab.id < 0) return;
  const url = tab.url || tab.pendingUrl || "";
  // tab.url can be empty until host permissions settle; treat unknown as
  // allowed and let executeScript fail loudly rather than dead-silencing.
  if (url && !/^https?:/.test(url) && !url.startsWith("file:")) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (msg) => { alert(msg); },
        args: ["Vibe Selector works on http(s)/file pages only."],
      });
    } catch (_) {}
    return;
  }
  const active = await stickyIsActive(tab.id);
  if (active) {
    // Ask the page to destroy the picker. The picker itself also clears the
    // sticky flag via HOST.onClosed → session.close; the explicit clear here
    // covers pages where the message roundtrip fails.
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "vibe-toggle" });
    } catch (_) {
      // Shim gone (crashed page). Just drop the sticky flag.
    }
    await stickySet(tab.id, null);
    return;
  }
  await injectPicker(tab.id);
  await stickySet(tab.id, { at: Date.now(), open: true });
}

chrome.action.onClicked.addListener((tab) => { togglePicker(tab); });

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  if (command === "_execute_action") { await togglePicker(tab); return; }
  // Action shortcuts act on the ALREADY-RUNNING picker in the page; if it is
  // not running, activate first so the shortcut never feels dead.
  const active = await stickyIsActive(tab.id);
  if (!active) {
    const url = tab.url || "";
    if (url && !/^https?:/.test(url) && !url.startsWith("file:")) return;
    await injectPicker(tab.id);
    await stickySet(tab.id, { at: Date.now(), open: true });
    // Give the payload a beat to boot before the action arrives.
    await new Promise(r => setTimeout(r, 120));
  }
  try { await chrome.tabs.sendMessage(tab.id, { type: "vibe-action", action: command }); }
  catch (_) {}
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "vibe-activate",
    title: "Vibe Selector — select elements on this page",
    contexts: ["page", "selection", "link", "image"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "vibe-activate" && tab) await togglePicker(tab);
});

// ── Self re-injection after reload / SPA navigation ─────────
// The shim listens for complete/navigated events too; this belt-and-suspenders
// path covers tabs whose shim died with the page but sticky state remains.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!(await stickyIsActive(tabId))) return;
  const url = (tab && tab.url) || "";
  if (!/^https?:/.test(url) && !url.startsWith("file:")) { await stickySet(tabId, null); return; }
  try {
    await injectPicker(tabId);
    // refresh heartbeat
    await stickySet(tabId, { at: Date.now(), open: true });
  } catch (_) {
    // Page likely blocked injection (chrome:// etc). Drop sticky state.
    await stickySet(tabId, null);
  }
});

// Tab closed → forget.
chrome.tabs.onRemoved.addListener(async (tabId) => { await stickySet(tabId, null); });
