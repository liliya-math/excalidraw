"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const createPolicy = (dataDir) => {
  const cache = new Map();
  const record = (room) => {
    const old = cache.get(room);
    if (old && old.value && Date.now() - old.at < 500) return old.value;
    let value = null;
    try { const stored = JSON.parse(fs.readFileSync(path.join(dataDir, "workspaces", `${room}.json`), "utf8")); value = { teacherHash: stored.teacherHash, studentHash: stored.studentHash }; } catch {}
    cache.set(room, { at: Date.now(), value });
    if (cache.size > 5000) cache.delete(cache.keys().next().value);
    return value;
  };
  const canWrite = (socket, room) => {
    if (!/^[\w-]{1,128}$/.test(room)) return false;
    const entry = record(room);
    if (!entry) return true;
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return false;
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    return hash === entry.teacherHash || hash === entry.studentHash;
  };
  return {
    join(socket, room) { return typeof room === "string" && /^[\w-]{1,128}$/.test(room) && (!socket.data.liliRoom || socket.data.liliRoom === room); },
    broadcast(socket, target) {
      const room = socket.data.liliRoom;
      return !!room && socket.rooms.has(room) && canWrite(socket, room) && (target === room || target === `follow@${socket.id}`);
    },
    follow(socket, payload) {
      const target = payload?.userToFollow?.socketId;
      const room = socket.data.liliRoom;
      return !!room && typeof target === "string" && socket.nsp.sockets.get(target)?.rooms.has(room) === true;
    },
  };
};
const install = () => {
  const { Server } = require(path.join(process.cwd(), "node_modules/socket.io"));
  const policy = createPolicy(process.env.LILI_DATA_DIR || "/var/lib/lili-storage");
  const on = Server.prototype.on;
  Server.prototype.on = function (event, handler) {
    if (event !== "connection") return on.call(this, event, handler);
    return on.call(this, event, (socket) => {
      const originalOn = socket.on.bind(socket);
      socket.on = (name, listener) => {
        if (name === "join-room") return originalOn(name, async (room) => { if (!policy.join(socket, room)) return; socket.data.liliRoom = room; await listener(room); });
        if (["server-broadcast", "server-volatile-broadcast"].includes(name)) return originalOn(name, (target, ...args) => { if (policy.broadcast(socket, target)) listener(target, ...args); });
        if (name === "user-follow") return originalOn(name, (payload) => { if (policy.follow(socket, payload)) listener(payload); });
        return originalOn(name, listener);
      };
      handler(socket);
    });
  };
};
module.exports = { createPolicy, install };
if (process.env.LILI_RELAY_AUTH === "1") install();
