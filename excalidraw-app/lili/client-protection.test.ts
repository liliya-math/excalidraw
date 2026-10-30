import { webcrypto } from "node:crypto";

import { convertToExcalidrawElements } from "@excalidraw/excalidraw";

import {
  clientIsStudent,
  clientPinnedIds,
  enforceClientProtection,
  initClientProtection,
  pinElements,
  receiveClientProtection,
  setClientOwner,
  unpinElements,
} from "./client-protection";
import {
  claimClientWorkspace,
  decorateInvite,
  initWorkspace,
  prepareClientTeacher,
  recoveryLink,
} from "./workspace";

const owner = "a".repeat(64);
let room = 0;
beforeEach(() => {
  initClientProtection(`test-${room++}`);
  setClientOwner(owner);
});
const example = () =>
  convertToExcalidrawElements([
    { type: "rectangle", x: 10, y: 20, width: 100, height: 80 },
    { type: "ellipse", x: 200, y: 30, width: 30, height: 30 },
  ]);

it("restores pupil moves, unlocks, deletions and clear while keeping their solution", () => {
  const original = example();
  const pinned = pinElements(original, { [original[0].id]: true });
  setClientOwner(null);
  expect(clientIsStudent()).toBe(true);
  const tampered = {
    ...pinned[0],
    x: 999,
    locked: false,
    isDeleted: true,
    customData: {},
    version: 100,
  };
  const guarded = enforceClientProtection([tampered, pinned[1]]);
  expect(guarded[0]).toMatchObject({ x: 10, locked: true, isDeleted: false });
  expect(guarded[0].version).toBeGreaterThan(100);
  expect(guarded[1]).toBe(pinned[1]);
  expect(enforceClientProtection(guarded)).toBe(guarded);
  expect(enforceClientProtection(pinned.slice(0, 0))[0].id).toBe(
    original[0].id,
  );
});

it("keeps locks after reload and accepts teacher unpin from the shared scene", () => {
  const original = example();
  const pinned = pinElements(original, { [original[0].id]: true });
  const unpinned = unpinElements(pinned, clientPinnedIds());
  expect(unpinned[0].locked).toBe(false);
  initClientProtection("reloaded-pupil");
  receiveClientProtection(pinned);
  expect(clientPinnedIds().size).toBe(1);
  expect(enforceClientProtection([{ ...pinned[0], x: 400 }])[0].x).toBe(10);
  receiveClientProtection(unpinned);
  expect(clientPinnedIds().size).toBe(0);
  expect(enforceClientProtection(unpinned)).toBe(unpinned);
});

it("does not let pupil controls unpin, but lets the owner unpin and edit", () => {
  const original = example();
  const pinned = pinElements(original, { [original[0].id]: true });
  setClientOwner(null);
  expect(unpinElements(pinned, clientPinnedIds())[0]).toBe(pinned[0]);
  setClientOwner(owner);
  expect(clientIsStudent()).toBe(false);
  const unpinned = unpinElements(pinned, clientPinnedIds());
  expect(unpinned[0].customData?.liliPin).toBeUndefined();
  const edited = [{ ...unpinned[0], x: 123 }];
  expect(enforceClientProtection(edited)).toBe(edited);
});

it("pins a frame and its contents together, and isolates rooms", () => {
  const elements = convertToExcalidrawElements([
    {
      type: "frame",
      id: "frame",
      children: ["child"],
      x: 0,
      y: 0,
      width: 400,
      height: 400,
    },
    {
      type: "rectangle",
      id: "child",
      x: 20,
      y: 20,
      width: 80,
      height: 80,
    },
  ]);
  const frame = elements.find((e) => e.type === "frame")!;
  const pinned = pinElements(elements, { [frame.id]: true });
  expect(pinned.every((e) => e.locked)).toBe(true);
  expect(clientPinnedIds().size).toBe(2);
  initClientProtection("another-room");
  expect(enforceClientProtection([])).toEqual([]);
});

it("recovers the teacher on another device without giving their key to pupils", async () => {
  Object.defineProperty(window, "crypto", {
    value: webcrypto,
    configurable: true,
  });
  window.localStorage.clear();
  const id = "client-test";
  const key = "AAAAAAAAAAAAAAAAAAAAAA";
  window.history.replaceState(null, "", `/#room=${id},${key}`);
  initWorkspace(window);
  await claimClientWorkspace({ id }, window);
  const teacherLink = recoveryLink(window)!;
  const pupilLink = decorateInvite(
    id,
    `https://example.org/#room=${id},${key}`,
  );
  const secret = teacherLink.split(";teacher=")[1];
  expect(secret).toHaveLength(64);
  expect(pupilLink).not.toContain(secret);
  const elements = example();
  const pinned = pinElements(elements, { [elements[0].id]: true });
  expect(JSON.stringify(pinned)).not.toContain(secret);
  window.localStorage.clear();
  window.history.replaceState(
    null,
    "",
    pupilLink.replace("https://example.org", ""),
  );
  initWorkspace(window);
  await prepareClientTeacher();
  receiveClientProtection(pinned);
  expect(clientIsStudent()).toBe(true);
  window.localStorage.clear();
  window.history.replaceState(null, "", teacherLink);
  initWorkspace(window);
  await prepareClientTeacher();
  receiveClientProtection(pinned);
  expect(clientIsStudent()).toBe(false);
  expect(unpinElements(pinned, clientPinnedIds())[0].locked).toBe(false);
});
