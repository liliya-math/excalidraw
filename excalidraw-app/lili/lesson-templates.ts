import {
  convertToExcalidrawElements,
  CaptureUpdateAction,
} from "@excalidraw/excalidraw";
import { getCommonBounds } from "@excalidraw/element/bounds";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

export type LessonTemplate = { id: string; name: string; sections: string[] };
const KEY = "lili-lesson-templates-v1";
export const builtinTemplates: LessonTemplate[] = [
  {
    id: "standard",
    name: "Обычный урок",
    sections: [
      "Повторение",
      "Новая тема",
      "Самостоятельная",
      "Домашнее задание",
    ],
  },
  {
    id: "revision",
    name: "Закрепление",
    sections: ["Разбор домашки", "Разбор ошибок", "Закрепление", "Итог"],
  },
  {
    id: "diagnostic",
    name: "Диагностика",
    sections: [
      "Устная проверка",
      "Основная работа",
      "Разбор",
      "План подготовки",
    ],
  },
];
export const validateTemplate = (raw: unknown): LessonTemplate => {
  const value = raw as LessonTemplate;
  if (
    !value ||
    !/^[a-z0-9-]{1,100}$/i.test(value.id || "") ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 100 ||
    !Array.isArray(value.sections) ||
    !value.sections.length ||
    value.sections.length > 12 ||
    value.sections.some(
      (s) => typeof s !== "string" || !s.trim() || s.length > 100,
    )
  ) {
    throw new Error(
      "У шаблона должны быть название и от 1 до 12 разделов, каждый до 100 символов.",
    );
  }
  return {
    id: value.id,
    name: value.name.trim(),
    sections: value.sections.map((s) => s.trim()),
  };
};
export const loadTemplates = (storage: Storage): LessonTemplate[] => {
  const raw = JSON.parse(storage.getItem(KEY) || "[]");
  if (!Array.isArray(raw) || raw.length > 30) {
    throw new Error("Не удалось прочитать шаблоны.");
  }
  return raw.map(validateTemplate);
};
export const saveTemplate = (storage: Storage, raw: LessonTemplate) => {
  const template = validateTemplate(raw);
  if (builtinTemplates.some((t) => t.id === template.id)) {
    throw new Error("Это имя встроенного шаблона. Создай личный шаблон.");
  }
  const list = loadTemplates(storage).filter((t) => t.id !== template.id);
  if (list.length >= 30) {
    throw new Error("Можно хранить до 30 личных шаблонов.");
  }
  storage.setItem(KEY, JSON.stringify([...list, template]));
  return template;
};
export const restoreTemplates = (storage: Storage, raw: unknown) => {
  const data = raw as { version: number; templates: unknown[] };
  if (
    data?.version !== 1 ||
    !Array.isArray(data.templates) ||
    data.templates.length > 30
  ) {
    throw new Error("Это не файл шаблонов урока.");
  }
  const incoming = data.templates.map(validateTemplate);
  if (incoming.some((t) => builtinTemplates.some((b) => b.id === t.id))) {
    throw new Error("Файл содержит идентификаторы встроенных шаблонов.");
  }
  const merged = new Map(loadTemplates(storage).map((t) => [t.id, t]));
  incoming.forEach((t) => merged.set(t.id, t));
  if (merged.size > 30) {
    throw new Error("Вместе получается больше 30 шаблонов.");
  }
  storage.setItem(KEY, JSON.stringify([...merged.values()]));
};
export const applyLessonTemplate = (
  api: ExcalidrawImperativeAPI,
  raw: LessonTemplate,
  prefix: string,
  scope: string,
  copy = false,
) => {
  const template = validateTemplate(raw);
  const all = api.getSceneElementsIncludingDeleted();
  const existing = all.filter(
    (e) =>
      !e.isDeleted &&
      e.type === "frame" &&
      e.customData?.liliTemplateId === template.id &&
      e.customData?.liliTemplateScope === scope,
  );
  if (existing.length && !copy) {
    api.setViewport({
      target: existing[0],
      fit: "scale-down",
      animation: true,
    });
    return { reused: true, frames: existing };
  }
  const live = all.filter((e) => !e.isDeleted);
  const x = live.length ? getCommonBounds(live)[2] + 100 : 0;
  const batch = `${api.getSceneElements().length}-${Date.now()}`;
  const frames = convertToExcalidrawElements(
    template.sections.map((section, i) => ({
      type: "frame" as const,
      x: x + (i % 2) * 1060,
      y: Math.floor(i / 2) * 1280,
      width: 960,
      height: 1180,
      name: [prefix.trim(), section].filter(Boolean).join(" · "),
      children: [],
      customData: {
        liliLesson: true,
        liliTemplateId: template.id,
        liliTemplateScope: scope,
        liliTemplateBatch: batch,
        liliTemplateSection: i,
      },
    })),
  );
  api.updateScene({
    elements: [...all, ...frames],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  api.setViewport({ target: frames[0], fit: "scale-down", animation: true });
  return { reused: false, frames };
};
