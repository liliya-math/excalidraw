import { createStore, get, set, del, values } from "idb-keyval";
import { CaptureUpdateAction, restoreElements } from "@excalidraw/excalidraw";
import { duplicateElements } from "@excalidraw/element/duplicate";
import { getCommonBounds } from "@excalidraw/element/bounds";
import { newElementWith } from "@excalidraw/element";
import { randomId } from "@excalidraw/common";

import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";
import type {
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

export type ContentTemplate = {
  version: 1;
  id: string;
  name: string;
  created: number;
  elements: readonly ExcalidrawElement[];
  files: BinaryFiles;
};
const MAX_BYTES = 25 * 1024 * 1024;
let database: ReturnType<typeof createStore> | undefined;
const store = () =>
  database ||
  (database = createStore("lili-content-templates-v1", "templates"));
export const validContentId = (id: string) => /^[a-z0-9_-]{1,100}$/i.test(id);
const cleanLink = (link: string | null) => {
  if (!link) {
    return null;
  }
  try {
    const url = new URL(link);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      return null;
    }
    if (["lilimath.ru", "liliya-math.github.io"].includes(url.hostname)) {
      for (const key of [
        "lili_student",
        "lili_hw",
        "lili_resume",
        "cabinet",
        "cabinetRole",
        "studentName",
        "lessonId",
      ]) {
        url.searchParams.delete(key);
      }
      // Room links are access credentials, not reusable lesson material.
      if (url.hash.startsWith("#room=")) {
        return null;
      }
    }
    return url.href;
  } catch {
    return null;
  }
};
export const validateContentTemplate = (input: unknown): ContentTemplate => {
  const data = input as ContentTemplate;
  if (
    JSON.stringify(input).length > MAX_BYTES ||
    data?.version !== 1 ||
    !validContentId(data.id || "") ||
    typeof data.name !== "string" ||
    !data.name.trim() ||
    data.name.length > 100 ||
    !Number.isFinite(data.created) ||
    !Array.isArray(data.elements) ||
    !data.elements.length ||
    data.elements.length > 5000 ||
    !data.files ||
    typeof data.files !== "object" ||
    Array.isArray(data.files)
  ) {
    throw new Error(
      "Нужен файл шаблона с названием и содержимым, до 25 МБ и 5000 объектов.",
    );
  }
  const elements = restoreElements(
    JSON.parse(JSON.stringify(data.elements)),
    null,
  ).filter((e) => !e.isDeleted);
  if (
    !elements.length ||
    new Set(elements.map((e) => e.id)).size !== elements.length
  ) {
    throw new Error(
      "В шаблоне нет объектов или повторяются их идентификаторы.",
    );
  }
  const files: BinaryFiles = {};
  for (const element of elements) {
    if (element.type !== "image") {
      continue;
    }
    const file = element.fileId && data.files[element.fileId];
    if (
      !file ||
      file.id !== element.fileId ||
      !/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.mimeType) ||
      typeof file.dataURL !== "string" ||
      !file.dataURL.startsWith(`data:${file.mimeType};base64,`)
    ) {
      throw new Error(
        "В шаблоне не хватает изображения. Дождись загрузки всех картинок и сохрани ещё раз.",
      );
    }
    files[file.id] = file;
  }
  return {
    version: 1,
    id: data.id,
    name: data.name.trim(),
    created: data.created,
    elements: elements.map((e) =>
      newElementWith(e, {
        customData: undefined,
        locked: false,
        link: cleanLink(e.link),
        ...(e.type === "embeddable" ? { link: cleanLink(e.link) } : {}),
      }),
    ),
    files,
  };
};
export const captureContentTemplate = (
  api: ExcalidrawImperativeAPI,
  name: string,
  selection: boolean,
): ContentTemplate => {
  const all = api.getSceneElements();
  const ids = new Set(
    Object.keys(api.getAppState().selectedElementIds).filter(
      (id) => api.getAppState().selectedElementIds[id],
    ),
  );
  if (selection && !ids.size) {
    throw new Error("Сначала выдели нужные объекты на доске.");
  }
  // Keep frame children and bound text with their selected parent.
  let changed = true;
  while (selection && changed) {
    changed = false;
    for (const e of all) {
      if (
        !ids.has(e.id) &&
        ((e.frameId && ids.has(e.frameId)) ||
          ("containerId" in e && e.containerId && ids.has(e.containerId)))
      ) {
        ids.add(e.id);
        changed = true;
      }
    }
  }
  const selectedElements = all.filter((e) => !selection || ids.has(e.id));
  const files: BinaryFiles = {};
  const sourceFiles = api.getFiles();
  for (const e of selectedElements) {
    if (e.type === "image" && e.fileId && sourceFiles[e.fileId]) {
      files[e.fileId] = sourceFiles[e.fileId];
    }
  }
  return validateContentTemplate({
    version: 1,
    id: `content-${randomId()}`,
    name,
    created: Date.now(),
    elements: selectedElements,
    files,
  });
};
export const listContentTemplates = async () =>
  (await values<ContentTemplate>(store())).sort(
    (a, b) => b.created - a.created,
  );
export const readContentTemplate = async (id: string) => {
  if (!validContentId(id)) {
    throw new Error("Некорректный шаблон.");
  }
  const data = await get(id, store());
  if (!data) {
    throw new Error(
      "Шаблон не найден в этом браузере. Открой свою доску и загрузи сохранённый файл шаблона.",
    );
  }
  return validateContentTemplate(data);
};
export const writeContentTemplate = async (data: unknown) => {
  const template = validateContentTemplate(data);
  const list = await listContentTemplates();
  if (list.length >= 50 && !list.some((t) => t.id === template.id)) {
    throw new Error("Можно хранить до 50 шаблонов. Выгрузи и удали ненужные.");
  }
  await set(template.id, template, store());
  return template;
};
export const deleteContentTemplate = (id: string) => del(id, store());
export const applyContentTemplate = (
  api: ExcalidrawImperativeAPI,
  input: ContentTemplate,
  copy = false,
) => {
  const template = validateContentTemplate(input);
  const all = api.getSceneElementsIncludingDeleted();
  const existing = all.filter(
    (e) => !e.isDeleted && e.customData?.liliContentTemplate === template.id,
  );
  if (existing.length && !copy) {
    api.setViewport({ target: existing, fit: "scale-down", animation: true });
    return { reused: true, elements: existing };
  }
  const live = all.filter((e) => !e.isDeleted);
  const left = live.length ? getCommonBounds(live)[2] + 120 : 0;
  const bounds = getCommonBounds(template.elements);
  const batch = randomId();
  const fileIds = new Map<string, FileId>();
  const files = Object.values(template.files).map((file) => {
    const id = randomId() as FileId;
    fileIds.set(file.id, id);
    return { ...file, id, created: Date.now() };
  });
  const { duplicatedElements } = duplicateElements({
    type: "everything",
    elements: template.elements,
    preserveFrameChildrenOrder: true,
    overrides: ({ duplicateElement: e }) => ({
      x: e.x + left - bounds[0],
      y: e.y - bounds[1],
      locked: false,
      customData: {
        liliContentTemplate: template.id,
        liliContentBatch: batch,
        ...(e.type === "frame" ? { liliLesson: true } : {}),
      },
      ...(e.type === "image" && e.fileId
        ? { fileId: fileIds.get(e.fileId), status: "pending" as const }
        : {}),
    }),
  });
  api.addFiles(files);
  api.updateScene({
    elements: [...all, ...duplicatedElements],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  api.setViewport({
    target: duplicatedElements,
    fit: "scale-down",
    animation: true,
  });
  return { reused: false, elements: duplicatedElements };
};
