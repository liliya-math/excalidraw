import { describe, expect, it, vi } from "vitest";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  boardTargetName,
  sameBoardAccess,
  mergeBoardRequest,
  registerBoardWindow,
  boardAccessHash,
} from "./board-window";
import { addMaterial, materialKey } from "./materials";
import {
  applyLessonTemplate,
  builtinTemplates,
  saveTemplate,
  restoreTemplates,
  loadTemplates,
} from "./lesson-templates";
const teacher = `https://liliya-math.github.io/excalidraw/#room=one,abcdefghijklmnopqrstuv;teacher=${"t".repeat(
  64,
)}`;
function fakeAPI() {
  let elements: readonly ExcalidrawElement[] = [];
  const api = {
    getSceneElements: () => elements.filter((e) => !e.isDeleted),
    getSceneElementsIncludingDeleted: () => elements,
    getAppState: () => ({
      width: 900,
      height: 800,
      zoom: { value: 1 },
      scrollX: 0,
      scrollY: 0,
    }),
    updateScene: (s: { elements: readonly ExcalidrawElement[] }) => {
      elements = s.elements;
    },
    setViewport: vi.fn(),
    addFiles: vi.fn(),
  } as unknown as ExcalidrawImperativeAPI;
  return api;
}
describe("board navigation", () => {
  it("isolates access roles and keeps lesson/video context on a new material request", () => {
    expect(
      sameBoardAccess(
        teacher,
        teacher.replace("/excalidraw/", "/excalidraw/?video=1"),
      ),
    ).toBe(true);
    expect(
      sameBoardAccess(teacher, teacher.replace(";teacher=", ";student=")),
    ).toBe(false);
    expect(boardTargetName(teacher)).not.toContain("t".repeat(64));
    const current = teacher.replace(
      "/excalidraw/",
      "/excalidraw/?cabinet=alice&lessonId=lesson-one&video=1",
    );
    const next = teacher.replace(
      "/excalidraw/",
      "/excalidraw/?cabinet=alice&material=https%3A%2F%2Flilimath.ru%2Ftest.html",
    );
    const merged = new URL(mergeBoardRequest(current, next));
    expect(merged.searchParams.get("lessonId")).toBe("lesson-one");
    expect(merged.searchParams.get("video")).toBe("1");
    expect(
      new URL(
        mergeBoardRequest(
          current,
          next.replace("cabinet=alice", "cabinet=bob"),
        ),
      ).searchParams.has("lessonId"),
    ).toBe(false);
  });
  it("accepts messages only from the cabinet with exactly the same room access", async () => {
    const listeners = new Map<string, (event: MessageEvent) => void>();
    const onOpen = vi.fn();
    const reply = vi.fn();
    const win = {
      location: { href: teacher, hash: new URL(teacher).hash },
      name: "",
      crypto: globalThis.crypto,
      addEventListener: (type: string, fn: (e: MessageEvent) => void) =>
        listeners.set(type, fn),
      removeEventListener: vi.fn(),
    };
    const clean = registerBoardWindow(
      { defaultView: win } as unknown as Document,
      onOpen,
    );
    const digest = await boardAccessHash(
      globalThis.crypto,
      new URL(teacher).hash,
    );
    const send = (origin: string, access: string) =>
      listeners.get("message")!({
        origin,
        source: { postMessage: reply },
        data: {
          type: "lili-board-open",
          requestId: "one",
          url: "https://liliya-math.github.io/excalidraw/?video=1",
          access,
        },
      } as unknown as MessageEvent);
    await send("https://evil.example", digest);
    expect(reply).not.toHaveBeenCalled();
    await send("https://lilimath.ru", "a".repeat(64));
    expect(onOpen).not.toHaveBeenCalled();
    expect(reply.mock.calls[0][0].accepted).toBe(false);
    await send("https://lilimath.ru", digest);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(win.name).toBe(boardTargetName(teacher));
    clean();
    expect(win.removeEventListener).toHaveBeenCalled();
  });
});
describe("material imports", () => {
  it("serializes repeated imports, permits an explicit copy and retains assignment identity", async () => {
    const api = fakeAPI();
    const win = { location: { hash: "#room=qa" } };
    const doc = { defaultView: win } as unknown as Document;
    await Promise.all([
      addMaterial(
        api,
        doc,
        "https://lilimath.ru/worksheet.html?lili_hw=1",
        "Лист",
        () => {},
      ),
      addMaterial(
        api,
        doc,
        "https://lilimath.ru/worksheet.html?lili_hw=1&lili_resume=1",
        "Лист",
        () => {},
      ),
    ]);
    expect(api.getSceneElements()).toHaveLength(1);
    await addMaterial(
      api,
      doc,
      "https://lilimath.ru/worksheet.html?lili_hw=1",
      "Лист",
      () => {},
      { duplicate: "copy" },
    );
    expect(api.getSceneElements()).toHaveLength(2);
    await addMaterial(
      api,
      doc,
      "https://lilimath.ru/worksheet.html?lili_hw=2",
      "Другой урок",
      () => {},
    );
    expect(api.getSceneElements()).toHaveLength(3);
    expect(materialKey("https://liliya-math.github.io/oge/a.pdf#page=2")).toBe(
      "https://lilimath.ru/a.pdf",
    );
  });
  it("does not insert an old request after the user changes rooms", async () => {
    const api = fakeAPI();
    const win = { location: { hash: "one" } };
    const doc = { defaultView: win } as unknown as Document;
    const pending = addMaterial(
      api,
      doc,
      "https://lilimath.ru/worksheet.html",
      "Лист",
      () => {},
    );
    win.location.hash = "two";
    await expect(pending).rejects.toThrow("Комната изменилась");
    expect(api.getSceneElements()).toHaveLength(0);
  });
});
describe("lesson templates", () => {
  it("creates fresh structures, reuses the same application and allows an explicit second set", () => {
    const a = fakeAPI();
    const b = fakeAPI();
    const first = applyLessonTemplate(
      a,
      builtinTemplates[0],
      "Урок",
      "lesson1",
    );
    expect(first.frames).toHaveLength(4);
    expect(
      applyLessonTemplate(a, builtinTemplates[0], "Урок", "lesson1").reused,
    ).toBe(true);
    expect(a.getSceneElements()).toHaveLength(4);
    applyLessonTemplate(a, builtinTemplates[0], "Урок", "lesson1", true);
    expect(a.getSceneElements()).toHaveLength(8);
    const other = applyLessonTemplate(
      b,
      builtinTemplates[0],
      "Урок",
      "lesson1",
    );
    expect(other.frames[0].id).not.toBe(first.frames[0].id);
    expect(b.addFiles).not.toHaveBeenCalled();
  });
  it("validates all imported templates before changing local storage", () => {
    const map = new Map();
    const storage = {
      getItem: (k: string) => map.get(k) || null,
      setItem: (k: string, v: string) => map.set(k, v),
    } as unknown as Storage;
    saveTemplate(storage, {
      id: "custom-one",
      name: "Мой урок",
      sections: ["Разбор", "Практика"],
    });
    const before = JSON.stringify(loadTemplates(storage));
    expect(() =>
      restoreTemplates(storage, {
        version: 1,
        templates: [{ id: "invalid", name: "", sections: [] }],
      }),
    ).toThrow();
    expect(JSON.stringify(loadTemplates(storage))).toBe(before);
  });
});
