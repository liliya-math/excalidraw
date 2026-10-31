import { createStore, get, set, setMany, values } from "idb-keyval";
import {
  CaptureUpdateAction,
  restoreElements,
  convertToExcalidrawElements,
} from "@excalidraw/excalidraw";
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
  updated?: number;
  deletedAt?: number;
  folder?: string;
  favorite?: boolean;
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
    updated: Number.isFinite(data.updated) ? data.updated : data.created,
    deletedAt:
      Number.isFinite(data.deletedAt) && data.deletedAt! > 0
        ? data.deletedAt
        : undefined,
    folder:
      typeof data.folder === "string" ? data.folder.trim().slice(0, 100) : "",
    favorite: data.favorite === true,
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
export const listContentTemplates = async (includeDeleted = false) =>
  (await values<ContentTemplate>(store()))
    .filter((t) => includeDeleted || !t.deletedAt)
    .sort((a, b) => (b.updated || b.created) - (a.updated || a.created));
export const readContentTemplate = async (id: string) => {
  if (!validContentId(id)) {
    throw new Error("Некорректный шаблон.");
  }
  const data = await get(id, store());
  if (!data || data.deletedAt) {
    throw new Error(
      "Шаблон не найден в этом браузере. Открой свою доску и загрузи сохранённый файл шаблона.",
    );
  }
  return validateContentTemplate(data);
};
export const writeContentTemplate = async (data: unknown) => {
  const template = validateContentTemplate(data);
  const list = await listContentTemplates(true);
  if (list.length >= 100 && !list.some((t) => t.id === template.id)) {
    throw new Error(
      "В библиотеке и корзине уже 100 материалов. Выгрузи резервную копию.",
    );
  }
  await set(template.id, template, store());
  return template;
};
export const updateContentMetadata = async (
  id: string,
  changes: { folder?: string; favorite?: boolean; deletedAt?: number },
) => {
  const current = await get<ContentTemplate>(id, store());
  if (!current) {
    throw new Error("Материал не найден.");
  }
  return writeContentTemplate({
    ...current,
    ...changes,
    updated: Math.max(
      Date.now(),
      (current.updated || current.created) + 1,
      (current.deletedAt || 0) + 1,
    ),
  });
};
export const deleteContentTemplate = (id: string) =>
  updateContentMetadata(id, { deletedAt: Date.now() });
export const restoreContentTemplate = (id: string) =>
  updateContentMetadata(id, { deletedAt: 0 });
export const mergeContentLibraries = (
  local: ContentTemplate[],
  remote: ContentTemplate[],
) => {
  const result = new Map<string, ContentTemplate>();
  for (const raw of [...local, ...remote]) {
    const item = validateContentTemplate(raw);
    const previous = result.get(item.id);
    const stamp = (t: ContentTemplate) =>
      Math.max(t.updated || t.created, t.deletedAt || 0);
    if (
      !previous ||
      stamp(item) > stamp(previous) ||
      (stamp(item) === stamp(previous) && item.deletedAt)
    ) {
      result.set(item.id, item);
    }
  }
  if (result.size > 100) {
    throw new Error(
      "Вместе получается больше 100 материалов. Локальная библиотека сохранена.",
    );
  }
  return [...result.values()];
};
export const replaceContentLibrary = async (items: ContentTemplate[]) => {
  const merged = mergeContentLibraries(await listContentTemplates(true), items);
  await setMany(
    merged.map((item) => [item.id, item]),
    store(),
  );
};
export const applyContentTemplate = (
  api: ExcalidrawImperativeAPI,
  input: ContentTemplate,
  copy = false,
  destination?: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  },
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
  if (destination && template.elements.some((e) => e.type === "frame")) {
    throw new Error("Для материала с разделами выбери отдельную область.");
  }
  const children = destination
    ? live.filter((e) => e.frameId === destination.id)
    : [];
  const top = destination
    ? children.length
      ? getCommonBounds(children)[3] + 40
      : destination.y + 50
    : 0;
  const left = destination
    ? destination.x + 30
    : live.length
    ? getCommonBounds(live)[2] + 120
    : 0;
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
      y: e.y + top - bounds[1],
      ...(destination ? { frameId: destination.id } : {}),
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
  let additions: readonly ExcalidrawElement[] = duplicatedElements;
  if (!destination && !template.elements.some((e) => e.type === "frame")) {
    const frame = convertToExcalidrawElements([
      {
        type: "frame",
        x: left - 30,
        y: top - 40,
        width: Math.max(400, bounds[2] - bounds[0] + 60),
        height: Math.max(240, bounds[3] - bounds[1] + 80),
        name: template.name,
        children: [],
        customData: {
          liliLesson: true,
          liliContentTemplate: template.id,
          liliContentBatch: batch,
        },
      },
    ])[0];
    additions = [
      ...duplicatedElements.map((e) =>
        newElementWith(e, { frameId: frame.id }),
      ),
      frame,
    ];
  }
  api.addFiles(files);
  const adjusted = destination
    ? all.map((e) =>
        e.id === destination.id
          ? newElementWith(e, {
              width: Math.max(e.width, bounds[2] - bounds[0] + 60),
              height: Math.max(
                e.height,
                top - e.y + bounds[3] - bounds[1] + 40,
              ),
            })
          : e,
      )
    : all;
  api.updateScene({
    elements: [...adjusted, ...additions],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  api.setViewport({
    target: additions,
    fit: "scale-down",
    animation: true,
  });
  return { reused: false, elements: additions };
};
