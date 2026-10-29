// lili.math board storage: keeps encrypted boards and images on this server.
// The board encrypts everything in the browser with the key from the link,
// so this server only ever sees ciphertext.
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3003);
const ORIGIN = process.env.CORS_ORIGIN || "*";
const DATA = process.env.DATA_DIR || "/var/lib/lili-storage";
const MAX_SCENE = 30 * 1024 * 1024;
const MAX_FILE = 12 * 1024 * 1024;
const SEGMENT = /^[A-Za-z0-9_-]{1,128}$/;

fs.mkdirSync(path.join(DATA, "scenes"), { recursive: true });
fs.mkdirSync(path.join(DATA, "files"), { recursive: true });

const send = (res, status, body, type = "application/json") => {
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": ORIGIN,
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
  });
  res.end(
    body === undefined
      ? ""
      : Buffer.isBuffer(body)
      ? body
      : typeof body === "string"
      ? body
      : JSON.stringify(body),
  );
};

const readBody = (req, limit) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error("too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

const writeAtomic = (file, data) => {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
};

// per-scene write lock so revision checks are atomic within this process
const locks = new Map();
const withLock = async (key, fn) => {
  const prev = locks.get(key) || Promise.resolve();
  let release;
  const next = new Promise((r) => (release = r));
  const queued = prev.then(() => next);
  locks.set(key, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === queued) {
      locks.delete(key);
    }
  }
};

const readScene = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
};

const workspace = require("./workspace")({ DATA, send, readBody, readScene, writeAtomic, withLock });

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      return send(res, 204);
    }
    const url = new URL(req.url, "http://x");
    const parts = url.pathname.split("/").filter(Boolean);
    if (await workspace.handle(req, res, parts)) return;
    if (parts[0] !== "storage") {
      return send(res, 404, { error: "not found" });
    }
    const [, kind, ...rest] = parts;
    if (!rest.length || !rest.every((s) => SEGMENT.test(s))) {
      return send(res, 400, { error: "bad path" });
    }

    if (kind === "scenes" && rest.length === 1) {
      const file = path.join(DATA, "scenes", `${rest[0]}.json`);
      if (req.method === "GET") {
        const scene = readScene(file);
        return scene ? send(res, 200, scene) : send(res, 404, { error: "none" });
      }
      if (req.method === "PUT") {
        if (!workspace.canWrite(req, rest[0])) return send(res, 403, { error: "room access required" });
        const expected = Number(url.searchParams.get("rev") || 0);
        const body = JSON.parse((await readBody(req, MAX_SCENE)).toString());
        if (
          typeof body.iv !== "string" ||
          typeof body.ciphertext !== "string" ||
          typeof body.sceneVersion !== "number"
        ) {
          return send(res, 400, { error: "bad scene" });
        }
        return await withLock(file, () => {
          const current = readScene(file);
          const rev = current ? current.rev : 0;
          if (rev !== expected) {
            return send(res, 409, { error: "conflict", rev });
          }
          const next = {
            rev: rev + 1,
            sceneVersion: body.sceneVersion,
            iv: body.iv,
            ciphertext: body.ciphertext,
            updated: new Date().toISOString(),
          };
          workspace.snapshot(rest[0], current);
          writeAtomic(file, JSON.stringify(next));
          return send(res, 200, { rev: next.rev });
        });
      }
    }

    if (kind === "files") {
      const dir = path.join(DATA, "files", ...rest.slice(0, -1));
      const file = path.join(dir, rest[rest.length - 1]);
      if (req.method === "GET") {
        if (!fs.existsSync(file)) {
          return send(res, 404, { error: "none" });
        }
        return send(res, 200, fs.readFileSync(file), "application/octet-stream");
      }
      if (req.method === "PUT") {
        const room = rest[0] === "files" && rest[1] === "rooms" ? rest[2] : null;
        if (room && !workspace.canWrite(req, room)) return send(res, 403, { error: "room access required" });
        const body = await readBody(req, MAX_FILE);
        if (room && fs.existsSync(file) && !workspace.canReplaceFile(req, room) && !fs.readFileSync(file).equals(body)) return send(res, 403, { error: "immutable file" });
        fs.mkdirSync(dir, { recursive: true });
        writeAtomic(file, body);
        return send(res, 200, { ok: true });
      }
    }

    return send(res, 404, { error: "not found" });
  } catch (error) {
    return send(res, error.status || 500, { error: String(error.message) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`lili storage on ${server.address().port}, data in ${DATA}`);
});
