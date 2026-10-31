import {
  convertToExcalidrawElements,
  CaptureUpdateAction,
} from "@excalidraw/excalidraw";
import { newElementWith } from "@excalidraw/element";
import { getCommonBounds } from "@excalidraw/element/bounds";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element/transform";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";
let active = "";
export const setActiveLesson = (id: string) => {
  active = id;
};
export const lessonFrames = (elements: readonly ExcalidrawElement[]) =>
  elements.filter((e) => e.type === "frame" && e.customData?.liliLesson);
export const lessonPlacement = (api: ExcalidrawImperativeAPI, width = 600) => {
  const state = api.getAppState();
  const all = api.getSceneElements();
  const frame = all.find((e) => e.id === active && e.type === "frame");
  const contents = frame
    ? all.filter((e) => e.frameId === frame.id)
    : all.filter((e) => e.type !== "frame");
  const bottom = contents.length
    ? getCommonBounds(contents)[3] + 40
    : frame
    ? frame.y + 50
    : state.height / 2 / state.zoom.value - state.scrollY;
  return {
    x: frame
      ? frame.x + 30
      : state.width / 2 / state.zoom.value - state.scrollX - width / 2,
    y: bottom,
    frameId: frame?.id || null,
  };
};
export const addLessonElements = (
  api: ExcalidrawImperativeAPI,
  skeletons: ExcalidrawElementSkeleton[],
  topLeft?: { x: number; y: number },
) => {
  let added = convertToExcalidrawElements(skeletons);
  if (topLeft && added.length) {
    const bounds = getCommonBounds(added);
    added = added.map((element) =>
      newElementWith(element, {
        x: element.x + topLeft.x - bounds[0],
        y: element.y + topLeft.y - bounds[1],
      }),
    );
  }
  let current = api.getSceneElements();
  for (const frame of lessonFrames(current)) {
    let children = added.filter((e) => e.frameId === frame.id);
    if (children.length) {
      const bounds = getCommonBounds(children);
      const dx = Math.max(0, frame.x + 30 - bounds[0]);
      const dy = Math.max(0, frame.y + 40 - bounds[1]);
      if (dx || dy) {
        added = added.map((e) =>
          e.frameId === frame.id
            ? newElementWith(e, { x: e.x + dx, y: e.y + dy })
            : e,
        );
        children = added.filter((e) => e.frameId === frame.id);
      }
      const right = Math.max(...children.map((e) => e.x + e.width)) + 30;
      const bottom = Math.max(...children.map((e) => e.y + e.height)) + 30;
      current = current.map((e) =>
        e.id === frame.id
          ? newElementWith(e, {
              width: Math.max(e.width, right - e.x),
              height: Math.max(e.height, bottom - e.y),
            })
          : e,
      );
    }
  }
  api.updateScene({
    elements: [...current, ...added],
    appState: { selectedElementIds: {} },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  if (added[0]) {
    api.setViewport({ target: added[0], fit: "scale-down", animation: true });
  }
  return added;
};
export const createLesson = (api: ExcalidrawImperativeAPI, name: string) => {
  const all = api.getSceneElements();
  const x = all.length ? getCommonBounds(all)[2] + 100 : 0;
  const frame = addLessonElements(api, [
    {
      type: "frame",
      x,
      y: 0,
      width: 960,
      height: 1180,
      name,
      children: [],
      customData: { liliLesson: true },
    },
  ])[0];
  setActiveLesson(frame.id);
  api.setViewport({ target: frame, fit: "scale-down", animation: true });
  return frame;
};
export const printableElements = (
  api: ExcalidrawImperativeAPI,
  frameId?: string,
) =>
  api
    .getSceneElements()
    .filter((e) => (frameId ? e.frameId === frameId : e.type !== "frame"));
