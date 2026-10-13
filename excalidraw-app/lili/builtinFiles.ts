// lili.math: images that ship with the board itself (mascot stickers).
// Every copy of the board loads them from its own site, so they never need to
// be uploaded to a storage server and they show up for every lesson
// participant.

import type { BinaryFileData, DataURL } from "@excalidraw/excalidraw/types";
import type { FileId } from "@excalidraw/element/types";

export type Sticker = { key: string; title: string };

export const STICKERS: Sticker[] = [
  { key: "cat", title: "Кот Сигма" },
  { key: "capy", title: "Капи Дзен" },
  { key: "rac", title: "Енот Вайб" },
  { key: "meer", title: "Сурик Шок" },
  { key: "lab", title: "Лаки Плюс" },
  { key: "ham", title: "Хомяк Стресс" },
  { key: "kit", title: "Котёнок Имба" },
  { key: "fox", title: "Лисёнок Флекс" },
  { key: "owl", title: "Совёнок Про" },
  { key: "bear", title: "Медвежонок Чил" },
  { key: "capykid", title: "Капибарёнок Релакс" },
  { key: "bun", title: "Крольчонок Спидран" },
];

const PREFIX = "lili-sticker-";

export const stickerFileId = (key: string) => `${PREFIX}${key}` as FileId;

export const isBuiltinFileId = (id: string) => id.startsWith(PREFIX);

const blobToDataURL = (blob: Blob) =>
  new Promise<DataURL>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as DataURL);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

let loading: Promise<Map<FileId, BinaryFileData>> | null = null;

export const loadBuiltinFiles = () => {
  if (!loading) {
    const base = import.meta.env.BASE_URL || "/";
    loading = Promise.all(
      STICKERS.map(async ({ key }) => {
        const res = await fetch(`${base}stickers/${key}.webp`);
        if (!res.ok) {
          throw new Error(`sticker ${key}: ${res.status}`);
        }
        const dataURL = await blobToDataURL(await res.blob());
        const file: BinaryFileData = {
          id: stickerFileId(key),
          mimeType: "image/webp",
          dataURL,
          created: 1,
        };
        return file;
      }),
    )
      .then((files) => new Map(files.map((f) => [f.id, f])))
      .catch((error) => {
        console.error(error);
        loading = null;
        return new Map<FileId, BinaryFileData>();
      });
  }
  return loading;
};

/** split requested ids into built-in files (served locally) and the rest */
export const takeBuiltinFiles = async (ids: readonly FileId[]) => {
  const builtinIds = ids.filter(isBuiltinFileId);
  const rest = ids.filter((id) => !isBuiltinFileId(id));
  if (!builtinIds.length) {
    return { builtin: [] as BinaryFileData[], missing: [] as FileId[], rest };
  }
  const all = await loadBuiltinFiles();
  const builtin: BinaryFileData[] = [];
  const missing: FileId[] = [];
  for (const id of builtinIds) {
    const file = all.get(id);
    if (file) {
      builtin.push(file);
    } else {
      missing.push(id);
    }
  }
  return { builtin, missing, rest };
};
