import { webcrypto } from "node:crypto";

import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import { encryptData } from "@excalidraw/excalidraw/data/encryption";

import { getCommonBounds } from "@excalidraw/element";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  readRoom,
  initWorkspace,
  fetchWorkspace,
  enforceProtection,
  decorateInvite,
  recoveryLink,
} from "./workspace";
import { trustedMaterialURL } from "./materials";
import { geometryElements } from "./geometry-tools";
import {
  addLessonElements,
  lessonPlacement,
  setActiveLesson,
} from "./lesson-model";

const id = "room123";
const key = "AAAAAAAAAAAAAAAAAAAAAA";
beforeEach(() => {
  Object.defineProperty(window, "crypto", {
    value: webcrypto,
    configurable: true,
  });
  window.localStorage.clear();
  window.history.replaceState(null, "", `/#room=${id},${key}`);
  initWorkspace(window);
});
afterEach(() => {
  vi.restoreAllMocks();
});
it("parses old and capability links without confusing student and teacher keys", () => {
  expect(readRoom(`#room=${id},${key}`)?.id).toBe(id);
  expect(readRoom(`#room=${id},${key};student=${"b".repeat(64)}`)?.role).toBe(
    "student",
  );
  expect(readRoom(`#room=${id},short`)).toBeNull();
  expect(readRoom(`#room=${id},${key};teacher=bad`)).toBeNull();
});
it("invites contain only the student capability", () => {
  const teacher = "a".repeat(64);
  const student = "b".repeat(64);
  window.localStorage.setItem(
    `lili-workspace-access-${id}`,
    JSON.stringify({ teacher, student }),
  );
  initWorkspace(window);
  const invite = decorateInvite(id, `https://example.org/#room=${id},${key}`);
  expect(invite).toContain(`;student=${student}`);
  expect(invite).not.toContain(teacher);
  expect(recoveryLink(window)).toContain(`;teacher=${teacher}`);
});
it("restores changed or deleted protected objects and advances their versions", async () => {
  const [element] = convertToExcalidrawElements([
    { type: "rectangle", x: 10, y: 20, width: 100, height: 70, locked: true },
  ]);
  const encrypted = await encryptData(
    key,
    new TextEncoder().encode(JSON.stringify([element])),
  );
  const base64 = (data: Uint8Array) => Buffer.from(data).toString("base64");
  vi.spyOn(window, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        exists: true,
        role: "student",
        revision: 1,
        protected: {
          iv: base64(encrypted.iv),
          ciphertext: base64(new Uint8Array(encrypted.encryptedBuffer)),
        },
      }),
    ),
  );
  await fetchWorkspace({ id, key }, window);
  const changed = { ...element, x: 999, locked: false, version: 100 };
  const result = enforceProtection([changed]);
  expect(result[0].x).toBe(10);
  expect(result[0].locked).toBe(true);
  expect(result[0].version).toBeGreaterThan(100);
  expect(enforceProtection([element].slice(0, 0))[0].id).toBe(element.id);
  const stable = enforceProtection(result);
  expect(stable).toBe(result);
});
it("allows only the user's material origins", () => {
  expect(trustedMaterialURL("dz.html")).toBe("https://lilimath.ru/dz.html");
  expect(trustedMaterialURL("https://lilimath.ru/dz.html")).toBeTruthy();
  for (const url of [
    ["java", "script:alert(1)"].join(""),
    "https://liliya-math.github.io.evil/oge/a",
    "https://example.com/a",
    "https://liliya-math.github.io/oge/../../evil",
  ]) {
    expect(trustedMaterialURL(url)).toBeNull();
  }
});
it("constructs finite grouped geometry with exact angle rays", () => {
  const shapes = geometryElements("angle", 60, 0, 0, "group", null);
  const elements = convertToExcalidrawElements(shapes);
  expect(elements.length).toBe(3);
  expect(elements.every((e) => e.groupIds.includes("group"))).toBe(true);
  for (const e of elements) {
    expect(Number.isFinite(e.width) && Number.isFinite(e.height)).toBe(true);
  }
  expect(() => geometryElements("angle", 181, 0, 0, "g", null)).toThrow();
});
it("a teacher recovery link recreates a student invite on another device", async () => {
  const teacher = "c".repeat(64);
  window.history.replaceState(
    null,
    "",
    `/#room=${id},${key};teacher=${teacher}`,
  );
  initWorkspace(window);
  vi.spyOn(window, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        exists: true,
        role: "teacher",
        revision: 1,
        protected: null,
      }),
    ),
  );
  await fetchWorkspace({ id, key }, window);
  const derived = Buffer.from(
    await webcrypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`student:${teacher}`),
    ),
  ).toString("hex");
  const invite = decorateInvite(id, `https://example.org/#room=${id},${key}`);
  expect(invite).toContain(`;student=${derived}`);
  expect(invite).not.toContain(teacher);
});

it("uses the board cell size for both a circle and its radius", () => {
  const elements = convertToExcalidrawElements(
    geometryElements("circle", 3, 0, 0, "g", null, 20),
  );
  expect(elements[0].width).toBe(120);
  expect(elements[0].height).toBe(120);
  expect(elements[1].width).toBe(60);
});

it("places upward geometry below existing work without overlapping it", () => {
  setActiveLesson("");
  const existing = convertToExcalidrawElements([
    { type: "rectangle", x: 0, y: 0, width: 100, height: 100 },
  ]);
  const api = {
    getSceneElements: () => existing,
    getAppState: () => ({
      width: 1000,
      height: 1000,
      zoom: { value: 1 },
      scrollX: 0,
      scrollY: 0,
    }),
    updateScene: vi.fn(),
    setViewport: vi.fn(),
  } as unknown as ExcalidrawImperativeAPI;
  const place = lessonPlacement(api);
  const added = addLessonElements(
    api,
    geometryElements("angle", 60, place.x, place.y, "g", null),
    place,
  );
  expect(getCommonBounds(added)[1]).toBeCloseTo(140);
});
