#!/usr/bin/env node
/**
 * Vibe Selector E2E — drives the REAL extension in headless Chrome.
 * Verifies the three improvements end-to-end (not by grepping strings):
 *   1. Alt-hold measurement: red guide lines + px labels + tag chip + box
 *   2. Settings shortcut record buttons render <kbd> key-caps (root-consistent)
 *   3. Settings panel: drag-follow + viewport clamp + custom scrollbar structure
 * Plus picker boot sanity (panel mounted, click-select works).
 *
 * Usage: node scripts/e2e.mjs   (expects dist-extension/ built)
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist-extension");
if (!fs.existsSync(path.join(DIST, "manifest.json"))) {
  console.error("dist-extension/ missing — run `npm run build` first");
  process.exit(1);
}

const CHROME_CANDIDATES = [
  // Chrome 137+ stable disables --load-extension. ego lite is Chromium-based
  // and still supports unpacked extensions in isolated test profiles.
  "/Applications/ego lite.app/Contents/MacOS/ego lite",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
];
const CHROME = CHROME_CANDIDATES.find(fs.existsSync);
if (!CHROME) { console.error("Chrome not found"); process.exit(1); }

const PORT = 18081, DBG = 19222;
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// ── test page ─────────────────────────────────────────────
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { font: 14px sans-serif; margin: 40px; }
  .row { display: flex; gap: 40px; align-items: flex-start; }
  #b1, #b2 { padding: 10px 16px; font-size: 14px; }
</style></head><body>
  <div class="row"><button id="b1">One</button><button id="b2">Two</button></div>
</body></html>`;

const server = createServer((req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); });
await new Promise(r => server.listen(PORT, "127.0.0.1", r));

// ── launch chrome ─────────────────────────────────────────
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-e2e-"));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DBG}`,
  `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check",
  `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`,
  "--window-size=1280,900", `http://127.0.0.1:${PORT}/`,
], { stdio: "ignore" });

const json = async (p) => (await fetch(`http://127.0.0.1:${DBG}${p}`)).json();
let targets = [];
for (let i = 0; i < 40; i++) {
  try { await json("/json/version"); break; } catch { await sleep(250); }
}
const isExtensionWorker = target => target.type === "service_worker"
  && /^chrome-extension:\/\/[^/]+\/background\.js(?:[?#].*)?$/.test(target.url || "");
for (let i = 0; i < 40; i++) {
  targets = await json("/json/list");
  if (targets.some(isExtensionWorker)) break;
  await sleep(250);
}
let pageT = targets.find(t => t.type === "page" && t.url.includes(`:${PORT}`));
if (!pageT) {
  // ego lite starts a fresh profile on its onboarding browser UI and ignores
  // the startup URL. Create a normal page target explicitly through CDP.
  const createUrl = `http://127.0.0.1:${DBG}/json/new?${encodeURIComponent(`http://127.0.0.1:${PORT}/`)}`;
  const created = await fetch(createUrl, { method: "PUT" });
  if (!created.ok) throw new Error(`cannot create test page: HTTP ${created.status}`);
  for (let i = 0; i < 40; i++) {
    targets = await json("/json/list");
    pageT = targets.find(t => t.type === "page" && t.url.includes(`:${PORT}`));
    if (pageT) break;
    await sleep(100);
  }
}
const swT = targets.find(isExtensionWorker);
if (!pageT || !swT) {
  console.error("targets missing:", targets.map(t => ({ type: t.type, url: t.url })));
  chrome.kill(); process.exit(1);
}

// ── minimal CDP client (global WebSocket, Node ≥ 21) ──────
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener("message", ev => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      }
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    return new CDP(ws);
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval failed");
    return r.result.value;
  }
}
const page = await CDP.connect(pageT.webSocketDebuggerUrl);
const sw = await CDP.connect(swT.webSocketDebuggerUrl);
await page.send("Runtime.enable");
await sw.send("Runtime.enable");
for (let i = 0; i < 40; i++) {
  if (await page.eval("document.readyState") === "complete") break;
  await sleep(100);
}

const injectExpr = `(async () => {
  const tabs = await chrome.tabs.query({});
  const tab = tabs.find(t => (t.url || "").includes("127.0.0.1:${PORT}")) || tabs.find(t => Number.isInteger(t.id));
  if (!tab || !tab.id) throw new Error("test tab not found: " + JSON.stringify(tabs.map(t => ({ id: t.id, url: t.url }))));
  const t = { tabId: tab.id };
  await chrome.scripting.executeScript({ target: t, files: ["content/shim.js"] });
  await new Promise(r => setTimeout(r, 250));
  await chrome.scripting.insertCSS({ target: t, files: ["picker/editor.css"] });
  await chrome.scripting.executeScript({ target: t, world: "MAIN", files: ["picker/host-adapter.js", "picker/editor.js", "picker/inject.js"] });
  return "injected tab " + tab.id;
})()`;

try {
  // ── boot ────────────────────────────────────────────────
  await sw.eval(injectExpr);
  await sleep(400);
  const boot = await page.eval(`({
    host: typeof window.__SELECTOR_HOST__,
    chat: !!document.querySelector(".agent-editor-chat"),
  })`);
  check("picker boot: host + chat panel", boot.host === "object" && boot.chat, JSON.stringify(boot));

  // ── click-select #b1 ───────────────────────────────────
  const sel = await page.eval(`(() => {
    const b = document.querySelector("#b1"); const r = b.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    for (const type of ["mousedown", "mouseup", "click"])
      b.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
    return !!document.querySelector(".agent-editor-sel-box");
  })()`);
  check("click-select creates selection box", sel);

  // ── 1. Alt measurement ─────────────────────────────────
  const measure = await page.eval(`(async () => {
    const b2 = document.querySelector("#b2"); const r = b2.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    b2.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, cancelable: true, clientX: x, clientY: y, altKey: true }));
    await new Promise(r2 => requestAnimationFrame(() => requestAnimationFrame(r2)));
    const layer = document.querySelector(".agent-editor-measure-layer");
    const lineH = layer && layer.querySelector(".agent-editor-measure-line-h");
    const lineV = layer && layer.querySelector(".agent-editor-measure-line-v");
    const label = layer && Array.from(layer.querySelectorAll(".agent-editor-measure-label")).map(l => l.textContent);
    const tag = layer && layer.querySelector(".agent-editor-measure-tag");
    const box = layer && layer.querySelector(".agent-editor-measure-box");
    const lineHRect = lineH && lineH.getBoundingClientRect();
    return {
      visible: !!layer && layer.style.display !== "none",
      lineH: !!lineH, lineV: !!lineV,
      lineHSize: lineHRect ? [Math.round(lineHRect.width), Math.round(lineHRect.height)] : null,
      labels: label || [], tag: tag ? tag.textContent : "", box: !!box,
    };
  })()`);
  check("Alt measure: layer visible", measure.visible);
  check("Alt measure: horizontal guide line present", measure.lineH);
  check("Alt measure: line renders ≥1px in BOTH dimensions (w,h)", !!measure.lineHSize && measure.lineHSize[0] > 5 && measure.lineHSize[1] >= 1, JSON.stringify(measure.lineHSize));
  check("Alt measure: px-unit labels", measure.labels.some(l => /^-?\d+px$/.test(l)), JSON.stringify(measure.labels));
  check("Alt measure: tag chip = hovered element", measure.tag === "button#b2", measure.tag);
  check("Alt measure: red box on hovered element", measure.box);

  const hide = await page.eval(`(async () => {
    document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 300, clientY: 300, altKey: false }));
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const layer = document.querySelector(".agent-editor-measure-layer");
    return !layer || layer.style.display === "none" || layer.children.length === 0;
  })()`);
  check("Alt release: measurement hides", hide);

  // ── 2. settings + kbd caps ─────────────────────────────
  const settings = await page.eval(`(() => {
    const btn = document.querySelector('[data-action="settings"]');
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    const panel = document.querySelector(".agent-editor-settings");
    if (!panel) return { open: false };
    const caps = panel.querySelectorAll(".agent-editor-shortcut-record kbd.agent-editor-kbd-cap");
    const firstBtn = panel.querySelector(".agent-editor-shortcut-record");
    const capStyle = caps.length ? getComputedStyle(caps[0]) : null;
    const rootKbd = document.querySelector(".agent-editor-shortcuts kbd");
    const rootStyle = rootKbd ? getComputedStyle(rootKbd) : null;
    return {
      open: true,
      caps: caps.length,
      firstText: firstBtn ? firstBtn.textContent.trim() : "",
      capFamily: capStyle ? capStyle.fontFamily : "",
      rootFamily: rootStyle ? rootStyle.fontFamily : "",
      fontMatch: !!capStyle && !!rootStyle && capStyle.fontFamily === rootStyle.fontFamily,
    };
  })()`);
  check("settings opens", settings.open);
  check("record buttons render kbd key-caps", settings.caps >= 3, `caps=${settings.caps}`);
  check("kbd font family matches root panel kbd", settings.fontMatch, `caps="${settings.capFamily}" root="${settings.rootFamily}"`);

  // ── 2b. custom extras: compact select + bidirectional i18n ─
  const i18n = await page.eval(`(async () => {
    const wait = () => new Promise(resolve => setTimeout(resolve, 80));
    const langButton = document.querySelector(".agent-editor-lang-btn");
    const row = key => document.querySelector('.agent-editor-setting-row[data-setting-extra="' + key + '"]');
    const text = (key, cls) => {
      const el = row(key) && row(key).querySelector("." + cls);
      return el ? el.textContent.trim() : "";
    };
    const read = () => ({
      settingsTitle: (document.querySelector(".agent-editor-settings-title") || {}).textContent || "",
      screenshotLabel: text("screenshotScope", "agent-editor-setting-label"),
      screenshotDesc: text("screenshotScope", "agent-editor-setting-desc"),
      screenshotValue: text("screenshotScope", "agent-editor-select-label"),
      autoLabel: text("autoSaveScreenshots", "agent-editor-setting-label"),
      autoDesc: text("autoSaveScreenshots", "agent-editor-setting-desc"),
      inlineLabel: text("inlineCrossOrigin", "agent-editor-setting-label"),
      inlineDesc: text("inlineCrossOrigin", "agent-editor-setting-desc"),
    });
    const currentLang = () => langButton.textContent.trim().startsWith("中文") ? "zh" : "en";
    const setLang = async wanted => {
      if (currentLang() !== wanted) { langButton.click(); await wait(); }
    };
    const optionTexts = async () => {
      const selectRow = row("screenshotScope");
      if (!selectRow) return [];
      const trigger = selectRow.querySelector(".agent-editor-select-trigger");
      if (!trigger) return [];
      trigger.click(); await wait();
      const values = Array.from(document.querySelectorAll(".agent-editor-select-pop .agent-editor-select-opt"), el => el.textContent.trim());
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await wait();
      return values;
    };

    await setLang("en");
    const en = read();
    const enOptions = await optionTexts();
    await setLang("zh");
    const zh = read();
    const zhOptions = await optionTexts();
    await setLang("en");
    const enAgain = read();

    const trigger = row("screenshotScope") && row("screenshotScope").querySelector(".agent-editor-select-trigger");
    const triggerRect = trigger ? trigger.getBoundingClientRect() : { height: 0 };
    const langRect = langButton.getBoundingClientRect();
    return {
      en, zh, enAgain, enOptions, zhOptions,
      extraKeys: Array.from(document.querySelectorAll(".agent-editor-setting-row[data-setting-extra]"), el => el.dataset.settingExtra),
      hostExtraKeys: Array.isArray(window.__SELECTOR_HOST__ && window.__SELECTOR_HOST__.uiExtras)
        ? window.__SELECTOR_HOST__.uiExtras.map(extra => extra.key) : [],
      triggerHeight: Math.round(triggerRect.height * 10) / 10,
      langHeight: Math.round(langRect.height * 10) / 10,
    };
  })()`);
  const englishExpected = i18n.en.settingsTitle.trim() === "Settings"
    && i18n.en.screenshotLabel === "Screenshot scope"
    && i18n.en.screenshotDesc === "Viewport, whole element, or full page"
    && i18n.en.screenshotValue === "Selection area"
    && i18n.en.autoLabel === "Auto-save PNG"
    && i18n.en.autoDesc === "Save the screenshot with every copy"
    && i18n.en.inlineLabel === "Inline cross-origin assets"
    && i18n.en.inlineDesc === "Fetch remote images, CSS and fonts for Mirror reports";
  const chineseExpected = i18n.zh.settingsTitle.trim() === "设置"
    && i18n.zh.screenshotLabel === "截图范围"
    && i18n.zh.screenshotDesc === "视口、整个元素或整页"
    && i18n.zh.screenshotValue === "选中区域"
    && i18n.zh.autoLabel === "自动保存 PNG"
    && i18n.zh.autoDesc === "每次复制时同时保存 PNG 文件"
    && i18n.zh.inlineLabel === "内联跨域资源"
    && i18n.zh.inlineDesc === "为镜像报告抓取远程图片、样式与字体";
  check("settings extras are mounted", i18n.extraKeys.length === 3, `DOM=${JSON.stringify(i18n.extraKeys)} HOST=${JSON.stringify(i18n.hostExtraKeys)}`);
  check("settings extras switch completely to English", englishExpected, JSON.stringify(i18n.en));
  check("settings extras switch completely to Chinese", chineseExpected, JSON.stringify(i18n.zh));
  check("settings extras switch back to English", JSON.stringify(i18n.enAgain) === JSON.stringify(i18n.en), JSON.stringify(i18n.enAgain));
  check("custom select options switch to English", i18n.enOptions.join("|") === "Selection area|Full element|Full page", JSON.stringify(i18n.enOptions));
  check("custom select options switch to Chinese", i18n.zhOptions.join("|") === "选中区域|整个元素|整页", JSON.stringify(i18n.zhOptions));
  check("custom select stays compact (no taller than language button)", i18n.triggerHeight <= i18n.langHeight + 1, `${i18n.triggerHeight}px vs ${i18n.langHeight}px`);

  // ── 3a. scrollbar structure ────────────────────────────
  const scroll = await page.eval(`(() => {
    const panel = document.querySelector(".agent-editor-settings");
    const wrap = panel && panel.querySelector(":scope > .agent-editor-scrollwrap");
    const scroller = wrap && wrap.querySelector(":scope > .agent-editor-scroll");
    const bar = wrap && wrap.querySelector(":scope > .agent-editor-scroll-bar");
    const thumb = bar && bar.querySelector(":scope > .agent-editor-scroll-bar-thumb");
    const nativeHidden = scroller ? getComputedStyle(scroller).scrollbarWidth === "none" : false;
    return {
      wrap: !!wrap, scroller: !!scroller, bar: !!bar, thumb: !!thumb,
      barOutsideScroll: !!(bar && scroller && !scroller.contains(bar)),
      nativeHidden,
    };
  })()`);
  check("settings scroll container present", scroll.wrap && scroll.scroller);
  check("scrollbar bar is sibling of scroll view (not scrolled away)", scroll.barOutsideScroll);
  check("scrollbar thumb present inside track", scroll.thumb);
  check("native scrollbar hidden", scroll.nativeHidden);

  // ── 3b. drag-follow ────────────────────────────────────
  const drag = await page.eval(`(async () => {
    const panel = document.querySelector(".agent-editor-settings");
    const chat = document.querySelector(".agent-editor-chat");
    const chatBefore = chat.getBoundingClientRect();
    const panelBefore = panel.getBoundingClientRect();
    const handle = chat.querySelector(".agent-editor-drag-handle");
    const hr = handle.getBoundingClientRect();
    const sx = hr.left + hr.width / 2, sy = hr.top + hr.height / 2;
    const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    handle.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX: sx, clientY: sy, button: 0 }));
    document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, cancelable: true, clientX: sx - 120, clientY: sy - 80 }));
    await frame(); // settings follow coalesces through rAF — let it land
    const chatAfter = chat.getBoundingClientRect();
    const panelAfter = panel.getBoundingClientRect();
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, clientX: sx - 120, clientY: sy - 80 }));
    await frame();
    const dChatLeft = Math.round(chatBefore.left - chatAfter.left);
    const dChatTop = Math.round(chatBefore.top - chatAfter.top);
    const dPanelBottom = Math.round(panelAfter.bottom - panelBefore.bottom);
    const dPanelRight = Math.round(panelAfter.right - panelBefore.right);
    return {
      chatMoved: dChatLeft >= 50 && dChatTop >= 30, // before-after deltas are positive when moving up-left
      followed: Math.abs(dPanelBottom) > 30 && Math.abs(dPanelRight) > 30,
      dChatLeft, dChatTop, dPanelBottom, dPanelRight,
    };
  })()`);
  check("drag moves chat panel", drag.chatMoved, JSON.stringify(drag));
  check("settings panel follows drag", drag.followed, JSON.stringify(drag));

  // ── 3c. viewport clamp ────────────────────────────
  // ego lite's CDP has no Emulation domain, and window.resizeTo is reserved
  // for popups. Assert the clamp math directly: evaluate the same condition
  // the resize listener enforces, at the current viewport size.
  const clamp = await page.eval(`(() => {
    const panel = document.querySelector(".agent-editor-settings");
    if (!panel) return { ok: false, why: "panel gone" };
    const r = panel.getBoundingClientRect();
    const vh = window.innerHeight, vw = window.innerWidth;
    return { ok: r.top >= 7 && r.bottom <= vh + 1 && r.right <= vw - 7 && r.left >= 7, top: Math.round(r.top), bottom: Math.round(r.bottom), right: Math.round(r.right), vh, vw };
  })()`);
  check("settings panel clamped inside viewport", clamp.ok, JSON.stringify(clamp));
} catch (err) {
  check("E2E ran without harness error", false, err.message);
} finally {
  chrome.kill();
  server.close();
}

const failed = results.filter(r => !r.pass);
console.log(`\n${failed.length === 0 ? "ALL PASS" : failed.length + " FAILED"}`);
process.exit(failed.length ? 1 : 0);
