/**
 * Vibe Selector — one-shot injection self-test.
 *
 * Load as an unpacked extension together with dist-extension (or paste the
 * body into the dist-extension service worker console). It re-runs the exact
 * injection sequence against the active tab and reports which stage broke,
 * so "nothing happens on the page" can be localized in seconds.
 *
 * Usage (dist-extension SW console):
 *   const m = await import(chrome.runtime.getURL("diagnose.js"));
 *   await m.diagnose();
 */

export async function diagnose(tabId) {
  const log = (...a) => console.log("[vibe-diagnose]", ...a);
  const tab = tabId
    ? await chrome.tabs.get(tabId)
    : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  log("target tab:", tab.id, tab.url);

  // Stage 1: can we execute at all?
  try {
    const [r] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: () => ({ readyState: document.readyState, hasHost: !!window.__SELECTOR_HOST__, hasShim: !!window.__VIBE_SHIM__ }),
    });
    log("stage1 probe:", JSON.stringify(r.result));
    if (r.result && r.result.hasShim) log("✅ shim alive");
    else log("❌ shim missing — injection never ran or page reloaded");
    if (r.result && r.result.hasHost) log("✅ host adapter alive");
    else log("❌ host adapter missing");
  } catch (e) { log("❌ stage1 executeScript failed:", e.message); return; }

  // Stage 2: files reachable?
  for (const f of ["content/shim.js", "picker/host-adapter.js", "picker/editor.js", "picker/inject.js", "picker/editor.css"]) {
    try { await fetch(chrome.runtime.getURL(f)); log("✅ file", f); }
    catch (_) { log("❌ file missing:", f); }
  }

  // Stage 3: full injection
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content/shim.js"] });
    await new Promise(r => setTimeout(r, 150));
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: "MAIN", files: ["picker/host-adapter.js", "picker/editor.js", "picker/inject.js"] });
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["picker/editor.css"] });
    log("✅ stage3 full injection done");
  } catch (e) { log("❌ stage3 injection failed:", e.message); return; }

  // Stage 4: picker mounted?
  const [r2] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    func: () => ({
      editorRoot: !!document.querySelector(".ai-editor-root"),
      layerHost: !!document.querySelector(".ai-editor-layer-host"),
      destroyHook: typeof window.__SELECTOR_DESTROY__,
    }),
  });
  log("stage4 picker state:", JSON.stringify(r2.result));
  if (r2.result.editorRoot) log("✅ picker UI mounted");
  else log("❌ picker UI NOT mounted — check the page console for errors from editor.js");
}
