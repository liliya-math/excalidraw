import {
  listContentTemplates,
  mergeContentLibraries,
  replaceContentLibrary,
} from "./content-templates";

import type { ContentTemplate } from "./content-templates";

type CloudData = { version: 1; revision: number; templates: ContentTemplate[] };
export const syncCloudLibrary = (doc: Document): Promise<number> => {
  const win = doc.defaultView!;
  const nonce = win.crypto.randomUUID();
  const popup = win.open(
    `https://lilimath.ru/kabinet.html?boardCloud=${nonce}#lilia`,
    "lili-library-account",
  );
  if (!popup) {
    return Promise.reject(
      new Error("Разреши открытие кабинета для синхронизации."),
    );
  }
  return new Promise((resolve, reject) => {
    let finished = false;
    let stage: "opening" | "loading" | "saving" | "applying" = "opening";
    const cleanup = () => {
      finished = true;
      win.clearTimeout(timer);
      win.removeEventListener("message", receive);
    };
    const timer = win.setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "Синхронизация не завершена. Локальные материалы сохранены. Войди в кабинет и повтори.",
        ),
      );
    }, 180000);
    const receive = async (event: MessageEvent) => {
      if (
        finished ||
        event.origin !== "https://lilimath.ru" ||
        event.source !== popup ||
        event.data?.nonce !== nonce ||
        event.data?.type !== "lili-cloud-account"
      ) {
        return;
      }
      try {
        if (event.data.error) {
          throw new Error(String(event.data.error));
        }
        if (event.data.stage === "ready" && stage === "opening") {
          stage = "loading";
          popup.postMessage(
            { type: "lili-cloud-request", nonce, action: "get" },
            "https://lilimath.ru",
          );
        } else if (event.data.stage === "loaded" && stage === "loading") {
          stage = "saving";
          const cloud = event.data.data as CloudData;
          if (
            cloud?.version !== 1 ||
            !Number.isInteger(cloud.revision) ||
            !Array.isArray(cloud.templates) ||
            cloud.templates.length > 100
          ) {
            throw new Error("Сервер вернул некорректную библиотеку.");
          }
          const merged = mergeContentLibraries(
            await listContentTemplates(true),
            cloud.templates,
          );
          // Only commit local changes after the server confirms this revision.
          popup.postMessage(
            {
              type: "lili-cloud-request",
              nonce,
              action: "put",
              revision: cloud.revision,
              templates: merged,
            },
            "https://lilimath.ru",
          );
        } else if (event.data.stage === "saved" && stage === "saving") {
          stage = "applying";
          const cloud = event.data.data as CloudData;
          if (
            cloud?.version !== 1 ||
            !Array.isArray(cloud.templates) ||
            cloud.templates.length > 100
          ) {
            throw new Error("Не удалось проверить сохранённую библиотеку.");
          }
          await replaceContentLibrary(cloud.templates);
          cleanup();
          resolve(cloud.templates.filter((t) => !t.deletedAt).length);
        }
      } catch (e) {
        cleanup();
        reject(e);
      }
    };
    win.addEventListener("message", receive);
  });
};
