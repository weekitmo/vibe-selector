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
