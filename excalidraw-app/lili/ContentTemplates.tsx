import { useEffect, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  applyContentTemplate,
  captureContentTemplate,
  deleteContentTemplate,
  listContentTemplates,
  readContentTemplate,
  writeContentTemplate,
  updateContentMetadata,
  restoreContentTemplate,
  mergeContentLibraries,
  replaceContentLibrary,
  validateContentTemplate,
} from "./content-templates";
import { ContentPreview } from "./ContentPreview";
import { syncCloudLibrary } from "./cloud-library";
import { takeSnapshot } from "./workspace";
import { download } from "./lesson-export";

import type { ContentTemplate } from "./content-templates";

export const ContentTemplates = ({
  api,
  doc,
  workspace,
  requested,
  notify,
}: {
  api: ExcalidrawImperativeAPI;
  doc: Document;
  workspace: string;
  requested: string;
  notify: (message: string) => void;
}) => {
  const win = doc.defaultView!;
  const [list, setList] = useState<ContentTemplate[]>([]);
  const [selected, setSelected] = useState(requested);
  const [name, setName] = useState("");
  const [scope, setScope] = useState("selection");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState("");
  const [favorites, setFavorites] = useState(false);
  const [trash, setTrash] = useState(false);
  const [folderDraft, setFolderDraft] = useState("");
  const [destination, setDestination] = useState("");
  const [syncStatus, setSyncStatus] = useState(
    "Материалы хранятся в этом браузере. Сохранение в аккаунте требует подключения сервера кабинета.",
  );
  const chosen = list.find((t) => t.id === selected);
  const folders = [
    ...new Set(
      list.filter((t) => !t.deletedAt && t.folder).map((t) => t.folder!),
    ),
  ].sort();
  const visible = list.filter(
    (t) =>
      !!t.deletedAt === trash &&
      (!folder || t.folder === folder) &&
      (!favorites || t.favorite) &&
      `${t.name} ${t.folder || ""}`
        .toLocaleLowerCase("ru")
        .includes(query.toLocaleLowerCase("ru")),
  );
  const frames = api.getSceneElements().filter((e) => e.type === "frame");
  const refresh = async () => setList(await listContentTemplates(true));
  useEffect(() => {
    void listContentTemplates(true)
      .then(setList)
      .catch((e) => notify(e.message));
  }, [notify]);
  useEffect(() => {
    if (requested) {
      setSelected(requested);
      setTrash(false);
    }
  }, [requested]);
  useEffect(() => {
    setFolderDraft(chosen?.folder || "");
    setDestination("");
  }, [chosen?.id, chosen?.folder]);
  const run = async (action: () => Promise<void>) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await action();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const apply = async (copy: boolean) => {
    if (!chosen || chosen.deletedAt) {
      return;
    }
    await run(async () => {
      if (api.getAppState().isLoading) {
        throw new Error("Дождись загрузки доски.");
      }
      const hash = win.location.hash;
      const template = await readContentTemplate(chosen.id);
      if (hash !== win.location.hash) {
        return;
      }
      const target = destination
        ? api
            .getSceneElements()
            .find((e) => e.id === destination && e.type === "frame")
        : undefined;
      if (destination && !target) {
        throw new Error("Выбранная область уже удалена. Выбери другую.");
      }
      await takeSnapshot(
        workspace,
        api,
        "Перед добавлением материала из шаблона",
      );
      if (hash !== win.location.hash) {
        return;
      }
      const result = applyContentTemplate(api, template, copy, target);
      notify(
        result.reused
          ? "Этот материал уже добавлен. Перешли к нему. Для новой копии нажми «Добавить ещё одну копию»."
          : "Копия добавлена. Исходный шаблон сохранён отдельно.",
      );
      const url = new URL(win.location.href);
      if (url.searchParams.get("contentTemplate") === chosen.id) {
        url.searchParams.delete("contentTemplate");
      }
      win.history.replaceState(null, "", url.href);
    });
  };
  const exportFile = (data: unknown, filename: string) =>
    download(
      doc,
      new win.Blob([JSON.stringify(data)], { type: "application/json" }),
      filename,
    );
  return (
    <section>
      <h3>Мои материалы</h3>
      <p>
        Сохраняй задания, рисунки и целые уроки. Ученику добавляется независимая
        копия.
      </p>
      <details>
        <summary>Хранение и резервная копия</summary>
        <a
          href="https://lilimath.ru/board-library-setup.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          Подключение хранения в аккаунте
        </a>
        <p className="hint" role="status">
          {syncStatus}
        </p>
        <button
          disabled={busy}
          onClick={() => {
            void run(async () => {
              setSyncStatus("Открываю кабинет для синхронизации…");
              try {
                const count = await syncCloudLibrary(doc);
                await refresh();
                setSyncStatus(
                  `Сохранено в аккаунте. Материалов: ${count}. Изменения после этого момента синхронизируй повторно.`,
                );
              } catch (e) {
                setSyncStatus(
                  `${(e as Error).message} Локальные материалы сохранены.`,
                );
                throw e;
              }
            });
          }}
        >
          Синхронизировать с аккаунтом
        </button>
        <button
          disabled={busy}
          onClick={() =>
            exportFile(
              { version: 2, templates: list },
              "lili-board-library-backup.json",
            )
          }
        >
          Выгрузить всю библиотеку с корзиной
        </button>
        <p className="hint">
          Корзина хранит удалённые материалы до восстановления. Снимки самой
          доски доступны в «Уроки → Снимки».
        </p>
      </details>
      <label>
        Название материала
        <input
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Что сохранить
        <select value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="selection">Выделенные объекты</option>
          <option value="all">Всю доску</option>
        </select>
      </label>
      <button
        disabled={busy || !name.trim()}
        onClick={() =>
          void run(async () => {
            if (api.getAppState().isLoading) {
              throw new Error("Дождись загрузки доски.");
            }
            const captured = captureContentTemplate(
              api,
              name,
              scope === "selection",
            );
            const saved = await writeContentTemplate({ ...captured, folder });
            await refresh();
            setSelected(saved.id);
            setTrash(false);
            setName("");
            notify("Материал сохранён вместе с рисунками и изображениями.");
          })
        }
      >
        Сохранить как шаблон
      </button>
      <hr />
      <label>
        Поиск по названию и папке
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected("");
          }}
        />
      </label>
      <label>
        Папка
        <select
          value={folder}
          onChange={(e) => {
            setFolder(e.target.value);
            setSelected("");
          }}
        >
          <option value="">Все папки</option>
          {folders.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
      <div className="lili-workspace__choices">
        <label>
          <input
            type="checkbox"
            checked={favorites}
            onChange={(e) => {
              setFavorites(e.target.checked);
              setSelected("");
            }}
          />
          Только избранное
        </label>
        <label>
          <input
            type="checkbox"
            checked={trash}
            onChange={(e) => {
              setTrash(e.target.checked);
              setSelected("");
              setFolder("");
              setFavorites(false);
            }}
          />
          Корзина · {list.filter((t) => t.deletedAt).length}
        </label>
      </div>
      <label>
        Сохранённые материалы
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Выбери материал</option>
          {visible.map((t) => (
            <option key={t.id} value={t.id}>
              {t.favorite ? "★ " : ""}
              {t.name}
              {t.folder ? ` · ${t.folder}` : ""}
            </option>
          ))}
        </select>
      </label>
      {!visible.length && (
        <p>
          {trash
            ? "Корзина пуста."
            : "Материалы не найдены. Измени поиск или сохрани новый материал."}
        </p>
      )}
      {requested && !chosen && (
        <p role="status">
          Выбери материал, синхронизируй аккаунт или загрузи файл шаблона с
          другого компьютера.
        </p>
      )}
      {chosen && (
        <>
          <ContentPreview template={chosen} />
          <p>
            <b>{chosen.name}</b> · объектов: {chosen.elements.length},
            изображений: {Object.keys(chosen.files).length}
          </p>
          {chosen.deletedAt ? (
            <>
              <p>
                Удалено {new Date(chosen.deletedAt).toLocaleString("ru-RU")}.
                Копии на досках сохранены.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await restoreContentTemplate(chosen.id);
                    await refresh();
                    setTrash(false);
                    notify("Материал восстановлен из корзины.");
                  })
                }
              >
                Восстановить из корзины
              </button>
            </>
          ) : (
            <>
              <label>
                Папка материала
                <input
                  value={folderDraft}
                  maxLength={100}
                  placeholder="8 класс / Квадратные корни"
                  onChange={(e) => setFolderDraft(e.target.value)}
                />
              </label>
              <div className="lili-workspace__choices">
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await updateContentMetadata(chosen.id, {
                        folder: folderDraft,
                      });
                      await refresh();
                      notify("Папка сохранена.");
                    })
                  }
                >
                  Сохранить папку
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await updateContentMetadata(chosen.id, {
                        favorite: !chosen.favorite,
                      });
                      await refresh();
                    })
                  }
                >
                  {chosen.favorite ? "Убрать из избранного" : "В избранное"}
                </button>
              </div>
              <label>
                Куда добавить
                <select
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                >
                  <option value="">Новая отдельная область</option>
                  {!chosen.elements.some((e) => e.type === "frame") &&
                    frames.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.type === "frame"
                          ? f.name || "Область без названия"
                          : ""}
                      </option>
                    ))}
                </select>
              </label>
              <p className="hint">
                Проверь предпросмотр и название комнаты перед добавлением.
                Материал с собственными разделами добавляется отдельно.
              </p>
              <div className="lili-workspace__choices">
                <button disabled={busy} onClick={() => void apply(false)}>
                  Добавить на эту доску / перейти
                </button>
                <button disabled={busy} onClick={() => void apply(true)}>
                  Добавить ещё одну копию
                </button>
                <a
                  className="lili-cabinet-return"
                  href={`https://lilimath.ru/kabinet.html?boardTemplate=${encodeURIComponent(
                    chosen.id,
                  )}#lilia`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Добавить ученику
                </a>
                <button
                  disabled={busy}
                  onClick={() => {
                    void run(async () => {
                      await deleteContentTemplate(chosen.id);
                      await refresh();
                      setSelected("");
                      notify(
                        "Материал перемещён в корзину. Его можно восстановить.",
                      );
                    });
                  }}
                >
                  В корзину
                </button>
              </div>
            </>
          )}
          <button
            disabled={busy}
            onClick={() => exportFile(chosen, `${chosen.id}.json`)}
          >
            Выгрузить файл материала
          </button>
        </>
      )}
      <label>
        Загрузить шаблон или резервную копию
        <input
          type="file"
          accept="application/json,.json"
          disabled={busy}
          onChange={(e) => {
            const input = e.currentTarget;
            const file = input.files?.[0];
            if (!file) {
              return;
            }
            void run(async () => {
              if (file.size > 40 * 1024 * 1024) {
                throw new Error("Файл больше 40 МБ.");
              }
              const data = JSON.parse(await file.text());
              if (data?.version === 2 && Array.isArray(data.templates)) {
                if (data.templates.length > 100) {
                  throw new Error("В резервной копии больше 100 материалов.");
                }
                const restored = mergeContentLibraries(
                  await listContentTemplates(true),
                  data.templates,
                );
                await replaceContentLibrary(restored);
                await refresh();
                notify(
                  "Библиотека и корзина восстановлены. Более новые изменения сохранены.",
                );
              } else {
                data.id = `content-${win.crypto.randomUUID()}`;
                const saved = await writeContentTemplate({
                  ...validateContentTemplate(data),
                  deletedAt: undefined,
                  updated: Date.now(),
                });
                await refresh();
                setSelected(saved.id);
                setTrash(false);
                notify("Шаблон загружен.");
              }
            }).finally(() => {
              input.value = "";
            });
          }}
        />
      </label>
    </section>
  );
};
