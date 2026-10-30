// Run after `vite build --base=/excalidraw/` to catch startup-size regressions.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const build = path.resolve(__dirname, "../excalidraw-app/build");
const html = fs.readFileSync(path.join(build, "index.html"), "utf8");
const worker = fs.readFileSync(path.join(build, "sw.js"), "utf8");
const initial = [
  ...html.matchAll(/(?:src|href)="[^"\s]*(assets\/[^"\s]+\.js)"/g),
].map((m) => m[1]);
const scripts = new Set();
function visit(file) {
  if (scripts.has(file)) {
    return;
  }
  scripts.add(file);
  const code = fs.readFileSync(path.join(build, file), "utf8");
  for (const match of code.matchAll(
    /(?:from|import)\s*["'](\.[^"']+\.js)["']/g,
  )) {
    visit(path.posix.join(path.posix.dirname(file), match[1]));
  }
}
initial.forEach(visit);
assert(scripts.size > 0, "No startup entry found");
let bytes = 0;
let gzip = 0;
for (const file of scripts) {
  const code = fs.readFileSync(path.join(build, file));
  bytes += code.length;
  gzip += zlib.gzipSync(code).length;
  const map = JSON.parse(
    fs.readFileSync(path.join(build, `${file}.map`), "utf8"),
  );
  assert(
    !map.sources.some((source) =>
      /node_modules\/(?:@firebase|firebase|mermaid|@excalidraw\/mermaid-to-excalidraw)\//.test(
        source,
      ),
    ),
    `Optional SDK in startup: ${file}`,
  );
  assert(
    worker.includes(`url:"${file}"`),
    `Startup script missing from offline cache: ${file}`,
  );
}
assert(bytes < 2100000, `Startup JS exceeds 2.1 MB: ${bytes}`);
assert(
  !/url:"assets\/(?:formula|pdf|firebase-storage)-[^" ]+\.js"/.test(worker),
  "Optional tools should cache on first use",
);
process.stdout.write(
  `${JSON.stringify({ startupScripts: [...scripts], bytes, gzip }, null, 2)}\n`,
);
