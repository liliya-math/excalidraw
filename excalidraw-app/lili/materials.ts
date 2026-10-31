import { newEmbeddableElement } from "@excalidraw/element/newElement";

import type {
  ExcalidrawImperativeAPI,
  BinaryFileData,
  DataURL,
} from "@excalidraw/excalidraw/types";
import type { FileId } from "@excalidraw/element/types";

import { addLessonElements, lessonPlacement } from "./lesson-model";
export type Material = {
  file: string;
  title: string;
  class?: number | null;
  type?: string;
  status?: string;
};
export const trustedMaterialURL = (value: string) => {
  try {
    const url = new URL(value, "https://liliya-math.github.io/oge/");
    const trusted =
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      ((url.hostname === "liliya-math.github.io" &&
        url.pathname.startsWith("/oge/")) ||
        ["lilimath.ru", "www.lilimath.ru"].includes(url.hostname));
    if (!trusted) {
      return null;
    }
    // The old GitHub Pages address redirects to HTTP. Use the HTTPS custom
    // domain directly so embedded lessons and PDF fetches avoid mixed content.
    if (url.hostname === "liliya-math.github.io") {
      url.hostname = "lilimath.ru";
      url.pathname = url.pathname.slice(4);
    }
    return url.href;
  } catch {
    return null;
  }
};
const importMaterial = async (
  api: ExcalidrawImperativeAPI,
  doc: Document,
  rawURL: string,
  title: string,
  progress: (value: string) => void,
  isCurrent: () => boolean,
) => {
  const win = doc.defaultView!;
  const url = trustedMaterialURL(rawURL);
  if (!url) {
    throw new Error(
      "Можно добавлять материалы только с lilimath.ru и сайта lili.math.",
    );
  }
  if (new URL(url).pathname.toLowerCase().endsWith(".pdf")) {
    progress("Загружаю PDF…");
    const response = await win.fetch(url);
    if (!response.ok) {
      throw new Error("Не удалось загрузить файл с сайта.");
    }
    if (Number(response.headers.get("Content-Length")) > 25 * 1024 * 1024) {
      throw new Error(
        "PDF больше 25 МБ. Открой нужные страницы через «Математика».",
      );
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 25 * 1024 * 1024) {
      throw new Error("PDF больше 25 МБ.");
    }
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = (
      await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
    ).default;
    const task = pdfjs.getDocument({ data: bytes, isEvalSupported: false });
    const pdf = await task.promise;
    try {
      const count = Math.min(10, pdf.numPages);
      const files: BinaryFileData[] = [];
      const skeletons = [];
      const place = lessonPlacement(api, 800);
      let y = place.y;
      for (let n = 1; n <= count; n++) {
        progress(`Добавляю страницу ${n} из ${count}…`);
        const page = await pdf.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({
          scale: Math.min(2, 1800 / Math.max(base.width, base.height)),
        });
        const canvas = doc.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({
          canvasContext: canvas.getContext("2d")!,
          viewport,
          background: "rgb(255,255,255)",
        }).promise;
        const fileId = win.crypto.randomUUID() as FileId;
        files.push({
          id: fileId,
          dataURL: canvas.toDataURL("image/jpeg", 0.88) as DataURL,
          mimeType: "image/jpeg",
          created: Date.now(),
        });
        const width = Math.min(800, base.width);
        const height = (width * base.height) / base.width;
        skeletons.push({
          type: "image" as const,
          x: place.x,
          y,
          frameId: place.frameId,
          width,
          height,
          fileId,
          locked: true,
          status: "pending" as const,
          customData: { materialURL: url, materialTitle: title },
        });
        y += height + 35;
        canvas.width = 0;
        page.cleanup();
      }
      if (!isCurrent()) {
        throw new Error("Комната изменилась. Добавление материала отменено.");
      }
      api.addFiles(files);
      addLessonElements(api, skeletons);
      return count < pdf.numPages
        ? `Добавлены первые ${count} страниц из ${pdf.numPages}.`
        : "PDF добавлен на доску.";
    } finally {
      await pdf.destroy();
    }
  }
  const place = lessonPlacement(api, 850);
  const element = newEmbeddableElement({
    type: "embeddable",
    ...place,
    width: 850,
    height: 1000,
    link: url,
    customData: { materialTitle: title, materialURL: url },
  });
  addLessonElements(api, [element]);
  return "Материал добавлен. Нажми на него дважды, чтобы работать внутри страницы.";
};

export const materialKey = (rawURL: string) => {
  const trusted = trustedMaterialURL(rawURL);
  if (!trusted) {
    return null;
  }
  const url = new URL(trusted);
  url.hostname = "lilimath.ru";
  for (const key of [...url.searchParams.keys()]) {
    if (["lili_resume"].includes(key) || key.startsWith("utm_")) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  if (url.pathname.toLowerCase().endsWith(".pdf")) {
    url.hash = "";
  }
  return url.href;
};
export const findMaterial = (api: ExcalidrawImperativeAPI, rawURL: string) => {
  const key = materialKey(rawURL);
  return key
    ? api
        .getSceneElements()
        .filter(
          (element) =>
            typeof element.customData?.materialURL === "string" &&
            materialKey(element.customData.materialURL) === key,
        )
    : [];
};
const imports = new WeakMap<ExcalidrawImperativeAPI, Promise<unknown>>();
export const addMaterial = (
  api: ExcalidrawImperativeAPI,
  doc: Document,
  rawURL: string,
  title: string,
  progress: (value: string) => void,
  options: { duplicate?: "reuse" | "copy" } = {},
): Promise<string> => {
  const hash = doc.defaultView!.location.hash;
  const isCurrent = () => doc.defaultView!.location.hash === hash;
  const previous = imports.get(api) || Promise.resolve();
  const current = previous
    .catch(() => {})
    .then(async () => {
      if (!isCurrent()) {
        throw new Error("Комната изменилась. Добавление материала отменено.");
      }
      const existing = findMaterial(api, rawURL);
      if (existing.length && options.duplicate !== "copy") {
        api.setViewport({
          target: existing[0],
          fit: "scale-down",
          animation: true,
        });
        return "Это задание уже есть на доске. Перешли к существующему материалу.";
      }
      return importMaterial(api, doc, rawURL, title, progress, isCurrent);
    });
  imports.set(api, current);
  void current
    .finally(() => {
      if (imports.get(api) === current) {
        imports.delete(api);
      }
    })
    .catch(() => {});
  return current;
};
