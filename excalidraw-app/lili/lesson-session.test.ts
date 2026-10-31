import { expect, it, vi } from "vitest";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { ensureLessonSession } from "./lesson-session";

it("reopens a persisted session without duplicating or clearing earlier lessons", () => {
  let elements: readonly ExcalidrawElement[] = [];
  const api = {
    getSceneElements: () => elements,
    updateScene: (update: { elements: readonly ExcalidrawElement[] }) => {
      elements = update.elements;
    },
    setViewport: vi.fn(),
  } as unknown as ExcalidrawImperativeAPI;
  const first = { lessonId: "one", date: "2026-10-31", title: "Корни" };
  const a = ensureLessonSession(api, first);
  const saved = JSON.parse(JSON.stringify(elements));
  elements = saved;
  const reopened = ensureLessonSession(api, first);
  expect(reopened.id).toBe(a.id);
  expect(elements).toHaveLength(1);
  ensureLessonSession(api, { ...first, lessonId: "two" });
  expect(elements).toHaveLength(2);
  expect(elements[0].id).toBe(a.id);
  expect(elements[1].x).toBeGreaterThan(elements[0].x + elements[0].width);
});
