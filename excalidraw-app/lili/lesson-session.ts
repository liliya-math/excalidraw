import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { newElementWith } from "@excalidraw/element";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { createLesson, lessonFrames } from "./lesson-model";

export const ensureLessonSession = (
  api: ExcalidrawImperativeAPI,
  session: { lessonId: string; date: string; title: string },
) => {
  const templated = lessonFrames(api.getSceneElements())
    .filter(
      (element) =>
        element.customData?.liliTemplateScope === session.lessonId &&
        element.customData?.liliTemplateSection === 0,
    )
    .at(-1);
  if (templated) {
    return templated;
  }
  const existing = lessonFrames(api.getSceneElements()).find(
    (element) => element.customData?.liliSessionId === session.lessonId,
  );
  if (existing) {
    return existing;
  }
  const made = createLesson(
    api,
    `${session.date} · ${session.title || "Занятие"}`,
  );
  const marked = newElementWith(made, {
    customData: {
      ...made.customData,
      liliSessionId: session.lessonId,
      liliLessonDate: session.date,
    },
  });
  api.updateScene({
    elements: api
      .getSceneElements()
      .map((element) => (element.id === made.id ? marked : element)),
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  return marked;
};
