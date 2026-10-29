"use strict";
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");
const validToken = (token) => typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
module.exports = ({ DATA, send, readBody, readScene, writeAtomic, withLock }) => {
  fs.mkdirSync(path.join(DATA, "workspaces"), { recursive: true });
  fs.mkdirSync(path.join(DATA, "history"), { recursive: true });
  const location = (id) => path.join(DATA, "workspaces", `${id}.json`);
  const tokenOf = (req) => String(req.headers.authorization || "").replace(/^Bearer /, "");
  const roleOf = (req, record) => {
    if (!record) return "legacy";
    const token = tokenOf(req);
    if (!validToken(token)) return "visitor";
    const digest = hash(token);
    return digest === record.teacherHash ? "teacher" : digest === record.studentHash ? "student" : "visitor";
  };
  const handle = async (req, res, parts) => {
    if (parts[0] !== "storage") return false;
    if (parts[1] === "capabilities" && req.method === "GET") { send(res, 200, { workspace: 1, protectedLayer: true, ice: true }); return true; }
    if (parts[1] === "ice" && req.method === "GET") {
      const iceServers = [{ urls: "stun:stun.cloudflare.com:3478" }];
      const room = new URL(req.url, "http://local").searchParams.get("room");
      const record = room && /^[\w-]{1,128}$/.test(room) ? readScene(location(room)) : null;
      if (process.env.TURN_SECRET && process.env.TURN_URL && record && ["teacher", "student"].includes(roleOf(req, record))) {
        const username = `${Math.floor(Date.now() / 1000) + 3600}:lesson`;
        const credential = crypto.createHmac("sha1", process.env.TURN_SECRET).update(username).digest("base64");
        iceServers.push({ urls: process.env.TURN_URL.split(","), username, credential });
      }
      send(res, 200, { iceServers }); return true;
    }
    if (parts[1] !== "workspaces" || parts.length !== 3) return false;
    const id = parts[2];
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) { send(res, 400, { error: "bad room" }); return true; }
    const file = location(id);
    if (req.method === "GET") {
      const record = readScene(file);
      send(res, 200, record ? { exists: true, role: roleOf(req, record), protected: record.protected || null, revision: record.revision, teacherSocketId: record.teacherSocketId || "" } : { exists: false }); return true;
    }
    if (!["POST", "PUT"].includes(req.method)) { send(res, 405, { error: "method" }); return true; }
    const body = JSON.parse((await readBody(req, 30 * 1024 * 1024)).toString());
    await withLock(file, () => {
      const current = readScene(file);
      if (req.method === "POST") {
        if (current) { send(res, 409, { error: "already claimed" }); return; }
        const teacher = tokenOf(req);
        if (!validToken(teacher) || !validToken(body.studentToken) || teacher === body.studentToken) { send(res, 400, { error: "bad credentials" }); return; }
        writeAtomic(file, JSON.stringify({ teacherHash: hash(teacher), studentHash: hash(body.studentToken), revision: 1, protected: null, teacherSocketId: "" }));
        send(res, 201, { revision: 1 }); return;
      }
      if (roleOf(req, current) !== "teacher") { send(res, 403, { error: "teacher only" }); return; }
      if (body.revision !== current.revision) { send(res, 409, { error: "revision", revision: current.revision }); return; }
      if (body.protected && (typeof body.protected.iv !== "string" || typeof body.protected.ciphertext !== "string")) { send(res, 400, { error: "bad protected layer" }); return; }
      const next = { ...current, revision: current.revision + 1, protected: body.protected === undefined ? current.protected : body.protected, teacherSocketId: typeof body.teacherSocketId === "string" ? body.teacherSocketId.slice(0,128) : current.teacherSocketId };
      writeAtomic(file, JSON.stringify(next)); send(res, 200, { revision: next.revision });
    });
    return true;
  };
  return {
    handle,
    canWrite(req, room) { return roleOf(req, readScene(location(room))) !== "visitor"; },
    canReplaceFile(req, room) { return ["legacy", "teacher"].includes(roleOf(req, readScene(location(room)))); },
    snapshot(id, current) {
      if (!current) return;
      const dir = path.join(DATA, "history", id); fs.mkdirSync(dir, { recursive: true });
      const entries = fs.readdirSync(dir).filter((s) => /^\d+\.json$/.test(s)).sort((a,b)=>Number(b.split(".")[0])-Number(a.split(".")[0]));
      if (entries[0] && Date.now() - fs.statSync(path.join(dir, entries[0])).mtimeMs < 5 * 60 * 1000) return;
      writeAtomic(path.join(dir, `${current.rev}.json`), JSON.stringify(current));
      for (const entry of entries.slice(11)) fs.unlinkSync(path.join(dir, entry));
    },
  };
};
