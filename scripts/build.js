#!/usr/bin/env node
/**
 * Build the Vibe Selector extension — zero external dependencies.
 *
 *   npm run build    Syntax-check extension JS, then pack extension/ into
 *                    dist-extension/ (the folder Chrome loads / the release
 *                    zip is made from).
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const extDir = path.join(root, "extension");
const dist = path.join(root, "dist-extension");

function read(p) { return fs.readFileSync(p, "utf8"); }
function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }
function copy(from, to) { ensureDir(path.dirname(to)); fs.copyFileSync(from, to); }

const JS_FILES = [
  "background.js",
  "content/shim.js",
  "picker/host-adapter.js",
  "picker/editor.js",
  "picker/inject.js",
];

const DIST_FILES = [
  "manifest.json",
  "background.js",
  "diagnose.js",
  "content/shim.js",
  "picker/host-adapter.js",
  "picker/editor.js",
  "picker/editor.css",
  "picker/inject.js",
  "icons/icon16.png",
  "icons/icon32.png",
  "icons/icon48.png",
  "icons/icon128.png",
];

function checkSyntax(rel) {
  const src = read(path.join(extDir, rel));
  try {
    new Function(src);
  } catch (err) {
    console.error(`[syntax] ${rel}: ${err.message}`);
    process.exitCode = 1;
  }
}

function buildDist() {
  const missing = DIST_FILES.filter(rel => !fs.existsSync(path.join(extDir, rel)));
  if (missing.length) {
    console.error(`[dist] missing files: ${missing.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  fs.rmSync(dist, { recursive: true, force: true });
  ensureDir(dist);
  for (const rel of DIST_FILES) copy(path.join(extDir, rel), path.join(dist, rel));
  console.log("[dist] dist-extension/ written");
}

for (const rel of JS_FILES) checkSyntax(rel);
if (!process.exitCode) buildDist();
