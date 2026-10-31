import { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  builtinTemplates,
  loadTemplates,
  saveTemplate,
  restoreTemplates,
  applyLessonTemplate,
} from "./lesson-templates";
import { takeSnapshot } from "./workspace";
import { download } from "./lesson-export";

export const LessonTemplates = ({
  api,
  doc,
  workspace,
  session,
  onApplied,
  notify,
}: {
  api: ExcalidrawImperativeAPI;
  doc: Document;
  workspace: string;
  session: string;
  onApplied: (id: string) => void;
  notify: (text: string) => void;
}) => {
  const win = doc.defaultView!;
  const [personal, setPersonal] = useState(() => {
    try {
      return loadTemplates(win.localStorage);
    } catch {
      return [];
    }
  });
  const [selected, setSelected] = useState("standard");
  const [prefix, setPrefix] = useState(
    new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long" }),
  );
  const [name, setName] = useState("");
  const [sections, setSections] = useState(
    builtinTemplates[0].sections.join("\n"),
  );
  const [busy, setBusy] = useState(false);
  const choices = [...builtinTemplates, ...personal];
  const template = choices.find((t) => t.id === selected) || choices[0];
  const apply = async (copy = false) => {
    if (busy || !prefix.trim()) {
      return;
    }
    if (api.getAppState().isLoading) {
      notify("Доска ещё загружается. Примени шаблон после открытия комнаты.");
      return;
    }
    setBusy(true);
    const hash = win.location.hash;
    try {
      const scope = session || prefix.trim();
      const exists = api
        .getSceneElements()
        .some(
          (element) =>
            element.customData?.liliTemplateId === template.id &&
            element.customData?.liliTemplateScope === scope,
        );
      if (copy || !exists) {
        await takeSnapshot(workspace, api, "Перед добавлением шаблона");
      }
      if (hash !== win.location.hash) {
        return;
      }
      const result = applyLessonTemplate(api, template, prefix, scope, copy);
      onApplied(result.frames[0].id);
      notify(
        result.reused
          ? "Этот шаблон уже применён. Перешли к его областям."
          : `Созданы области: ${template.sections.length}.`,
      );
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <h3>Шаблоны урока</h3>
      <p>
        Выбери структуру: для каждого раздела будет создана отдельная область
        доски.
      </p>
      <label>
        Шаблон
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {choices.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <ol>
        {template.sections.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <label>
        Подпись занятия
        <input
          maxLength={100}
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
        />
      </label>
      <div className="lili-workspace__choices">
        <button disabled={busy || !prefix.trim()} onClick={() => void apply()}>
          Применить шаблон
        </button>
        <button
          disabled={busy || !prefix.trim()}
          onClick={() => void apply(true)}
        >
          Добавить ещё один набор
        </button>
      </div>
      <details>
        <summary>Свой шаблон и перенос на другое устройство</summary>
        <p className="hint">
          Сохраняются названия разделов. Шаблоны хранятся в этом браузере.
        </p>
        <label>
          Название шаблона
          <input
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Разделы, каждый с новой строки
          <textarea
            value={sections}
            onChange={(e) => setSections(e.target.value)}
          />
        </label>
        <button
          onClick={() => {
            try {
              const saved = saveTemplate(win.localStorage, {
                id: `custom-${win.crypto.randomUUID()}`,
                name,
                sections: sections
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              });
              setPersonal(loadTemplates(win.localStorage));
              setSelected(saved.id);
              notify("Шаблон сохранён в этом браузере.");
            } catch (error) {
              notify((error as Error).message);
            }
          }}
        >
          Сохранить свой шаблон
        </button>
        <button
          onClick={() => {
            try {
              download(
                doc,
                new win.Blob(
                  [
                    JSON.stringify({
                      version: 1,
                      templates: loadTemplates(win.localStorage),
                    }),
                  ],
                  { type: "application/json" },
                ),
                "lesson-templates.json",
              );
            } catch (error) {
              notify((error as Error).message);
            }
          }}
        >
          Выгрузить шаблоны
        </button>
        <label>
          Загрузить шаблоны
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const file = e.currentTarget.files?.[0];
              if (!file) {
                return;
              }
              try {
                if (file.size > 200000) {
                  throw new Error("Файл больше 200 КБ.");
                }
                restoreTemplates(
                  win.localStorage,
                  JSON.parse(await file.text()),
                );
                setPersonal(loadTemplates(win.localStorage));
                notify("Шаблоны восстановлены.");
              } catch (error) {
                notify((error as Error).message);
              }
              e.target.value = "";
            }}
          />
        </label>
      </details>
    </section>
  );
};
