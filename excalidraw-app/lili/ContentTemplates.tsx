import { useEffect, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  applyContentTemplate,
  captureContentTemplate,
  deleteContentTemplate,
  listContentTemplates,
  readContentTemplate,
  writeContentTemplate,
} from "./content-templates";
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
  const chosen = list.find((t) => t.id === selected);
  const refresh = async () => setList(await listContentTemplates());
  useEffect(() => {
    void listContentTemplates()
      .then(setList)
      .catch((e) => notify(e.message));
  }, [notify]);
  useEffect(() => {
    if (requested) {
      setSelected(requested);
    }
  }, [requested]);
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
    if (!chosen) {
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
      await takeSnapshot(
        workspace,
        api,
        "Перед добавлением материала из шаблона",
      );
      if (hash !== win.location.hash) {
        return;
      }
      const result = applyContentTemplate(api, template, copy);
      notify(
        result.reused
          ? "Этот материал уже добавлен. Перешли к нему. Для новой копии нажми «Добавить ещё одну копию»."
          : "Копия добавлена на доску. Исходный шаблон сохранён отдельно.",
      );
      const url = new URL(win.location.href);
      if (url.searchParams.get("contentTemplate") === chosen.id) {
        url.searchParams.delete("contentTemplate");
      }
      win.history.replaceState(null, "", url.href);
    });
  };
  return (
    <section>
      <h3>Мои материалы</h3>
      <p>
        Сохраняй задания, рисунки и целые уроки. При добавлении на доску
        создаётся независимая копия.
      </p>
      <p className="hint">
        Материалы хранятся в этом браузере. Выгружай файлы для резервной копии и
        переноса на другой компьютер.
      </p>
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
            const saved = await writeContentTemplate(captured);
            await refresh();
            setSelected(saved.id);
            setName("");
            notify("Материал сохранён вместе с рисунками и изображениями.");
          })
        }
      >
        Сохранить как шаблон
      </button>
      <hr />
      <label>
        Сохранённые материалы
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Выбери материал</option>
          {list.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      {requested && !chosen && (
        <p role="status">
          Выбери материал или загрузи файл шаблона, если он сохранён на другом
          компьютере.
        </p>
      )}
      {chosen && (
        <>
          <p>
            <b>{chosen.name}</b> · объектов: {chosen.elements.length},
            изображений: {Object.keys(chosen.files).length}
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
              onClick={() =>
                download(
                  doc,
                  new win.Blob([JSON.stringify(chosen)], {
                    type: "application/json",
                  }),
                  `${chosen.id}.json`,
                )
              }
            >
              Выгрузить файл
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (
                  win.confirm(
                    `Удалить шаблон «${chosen.name}» из этого браузера? Копии на досках сохранятся.`,
                  )
                ) {
                  void run(async () => {
                    await deleteContentTemplate(chosen.id);
                    await refresh();
                    setSelected("");
                    notify("Шаблон удалён. Копии на досках сохранены.");
                  });
                }
              }}
            >
              Удалить шаблон
            </button>
          </div>
        </>
      )}
      {!list.length && (
        <p>
          Сохранённых материалов пока нет. Подготовь задание на своей доске,
          выдели его и нажми «Сохранить как шаблон».
        </p>
      )}
      <label>
        Загрузить файл шаблона
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
              if (file.size > 25 * 1024 * 1024) {
                throw new Error("Файл больше 25 МБ.");
              }
              const data = JSON.parse(await file.text());
              data.id = `content-${win.crypto.randomUUID()}`;
              const saved = await writeContentTemplate(data);
              await refresh();
              setSelected(saved.id);
              notify("Шаблон загружен. Теперь его можно добавить на доску.");
            }).finally(() => {
              input.value = "";
            });
          }}
        />
      </label>
    </section>
  );
};
