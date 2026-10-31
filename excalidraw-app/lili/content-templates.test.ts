import { describe, expect, it, vi } from "vitest";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";

import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  applyContentTemplate,
  captureContentTemplate,
  validateContentTemplate,
  mergeContentLibraries,
} from "./content-templates";

function board(
  initial: readonly ExcalidrawElement[],
  selected: Record<string, boolean> = {},
) {
  let elements = initial;
  return {
    getSceneElements: () => elements.filter((e) => !e.isDeleted),
    getSceneElementsIncludingDeleted: () => elements,
    getAppState: () => ({ selectedElementIds: selected }),
    getFiles: () => ({}),
    addFiles: vi.fn(),
    setViewport: vi.fn(),
    updateScene: (scene: { elements: readonly ExcalidrawElement[] }) => {
      elements = scene.elements;
    },
  } as unknown as ExcalidrawImperativeAPI;
}
describe("content templates", () => {
  it("copies selected frame and children with fresh IDs and no pupil metadata", () => {
    const source = convertToExcalidrawElements(
      [
        {
          id: "frame",
          type: "frame",
          x: 0,
          y: 0,
          width: 500,
          height: 500,
          name: "Корни",
          children: ["exercise"],
        },
        {
          id: "exercise",
          type: "rectangle",
          x: 20,
          y: 20,
          width: 100,
          height: 100,
          frameId: "frame",
          customData: { liliTemplateScope: "alice" },
          locked: true,
          link: "https://lilimath.ru/task.html?lili_student=alice&lili_hw=4",
        },
        {
          id: "unrelated",
          type: "ellipse",
          x: 800,
          y: 20,
          width: 100,
          height: 100,
        },
      ],
      { regenerateIds: false },
    );
    const saved = captureContentTemplate(
      board(source, { frame: true }),
      "Корни",
      true,
    );
    expect(saved.elements).toHaveLength(2);
    const exercise = saved.elements.find((e) => e.id === "exercise")!;
    expect(exercise.customData).toBeUndefined();
    expect(exercise.locked).toBe(false);
    expect(exercise.link).toBe("https://lilimath.ru/task.html");
    expect(source.find((e) => e.id === "exercise")!.locked).toBe(true);
    const destination = board([]);
    const result = applyContentTemplate(destination, saved);
    const copiedFrame = result.elements.find((e) => e.type === "frame")!;
    expect(result.elements.find((e) => e.type === "rectangle")!.frameId).toBe(
      copiedFrame.id,
    );
    expect(
      result.elements.every((e) => !source.some((s) => s.id === e.id)),
    ).toBe(true);
    expect(applyContentTemplate(destination, saved).reused).toBe(true);
    expect(destination.getSceneElements()).toHaveLength(2);
    applyContentTemplate(destination, saved, true);
    expect(destination.getSceneElements()).toHaveLength(4);
    expect(new Set(destination.getSceneElements().map((e) => e.id)).size).toBe(
      4,
    );
    expect(saved.elements.some((e) => e.id === "exercise")).toBe(true);
  });
  it("keeps images and gives destination files fresh IDs", () => {
    const elements = convertToExcalidrawElements([
      {
        id: "image",
        type: "image",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        fileId: "original" as FileId,
        status: "saved",
      },
    ]);
    const saved = validateContentTemplate({
      version: 1,
      id: "image-template",
      name: "Рисунок",
      created: 1,
      elements,
      files: {
        original: {
          id: "original",
          mimeType: "image/png",
          dataURL: "data:image/png;base64,YWJj",
          created: 1,
        },
      },
    });
    const api = board([]);
    const image = applyContentTemplate(api, saved).elements[0];
    expect(image.type).toBe("image");
    if (image.type === "image") {
      expect(image.fileId).not.toBe("original");
      expect(image.status).toBe("pending");
    }
    expect(api.addFiles).toHaveBeenCalledWith([
      expect.objectContaining({ dataURL: "data:image/png;base64,YWJj" }),
    ]);
    expect(() => validateContentTemplate({ ...saved, files: {} })).toThrow(
      "не хватает изображения",
    );
  });
  it("rejects empty selections and malformed imports before any scene edit", () => {
    const api = board([]);
    expect(() => captureContentTemplate(api, "Тема", true)).toThrow("выдели");
    expect(() => validateContentTemplate({ version: 2 })).toThrow();
    expect(api.getSceneElements()).toHaveLength(0);
  });
  it("merges old backups without reviving deleted items and keeps newer restores", () => {
    const elements = convertToExcalidrawElements([
      { type: "rectangle", x: 0, y: 0, width: 100, height: 100 },
    ]);
    const original = validateContentTemplate({
      version: 1,
      id: "content-test",
      name: "Корни",
      created: 1,
      elements,
      files: {},
    });
    const deleted = { ...original, updated: 5, deletedAt: 5 };
    expect(mergeContentLibraries([deleted], [original])[0].deletedAt).toBe(5);
    const restored = {
      ...original,
      updated: 8,
      deletedAt: undefined,
      folder: "8 класс / Корни",
      favorite: true,
    };
    const result = mergeContentLibraries([deleted], [restored])[0];
    expect(result.deletedAt).toBeUndefined();
    expect(result.favorite).toBe(true);
    expect(result.folder).toBe("8 класс / Корни");
    expect(() =>
      mergeContentLibraries([original], [{ ...original, name: "" }]),
    ).toThrow();
  });
  it("places a loose material inside the chosen frame without changing source", () => {
    const source = convertToExcalidrawElements([
      { type: "rectangle", x: 0, y: 0, width: 100, height: 100 },
    ]);
    const saved = captureContentTemplate(board(source), "Тема", false);
    const destination = board(
      convertToExcalidrawElements(
        [
          {
            id: "target",
            type: "frame",
            x: 500,
            y: 500,
            width: 600,
            height: 600,
            name: "Урок",
            children: [],
          },
        ],
        { regenerateIds: false },
      ),
    );
    const frame = destination.getSceneElements()[0];
    const result = applyContentTemplate(destination, saved, false, frame);
    expect(result.elements[0].frameId).toBe("target");
    expect(result.elements[0].x).toBeGreaterThan(500);
    expect(source[0].frameId).toBeNull();
  });
});
