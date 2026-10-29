import React, { useEffect, useRef, useState } from "react";
import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
} from "@excalidraw/excalidraw";

import { newElementWith, getCommonBounds } from "@excalidraw/element";

import { stringToBase64 } from "@excalidraw/excalidraw/data/encode";

import type {
  ExcalidrawImperativeAPI,
  BinaryFileData,
  DataURL,
} from "@excalidraw/excalidraw/types";
import type { FileId } from "@excalidraw/element/types";

import { graphSVG } from "./graph";

import "./MathTools.scss";

type Tab = "pdf" | "formula" | "graph";
const svgURL = (svg: string) =>
  `data:image/svg+xml;base64,${stringToBase64(svg)}`;
const templates = [
  ["Дробь", "\\frac{a}{b}"],
  ["Корень", "\\sqrt{x}"],
  ["Степень", "x^{2}"],
  ["Индекс", "a_{1}"],
  ["±", "\\pm"],
  ["≤", "\\le"],
  ["≥", "\\ge"],
  ["Система", "\\begin{cases}x+y=5\\\\x-y=1\\end{cases}"],
];

export const MathTools = ({
  api,
  onClose,
  initialTab = "pdf",
}: {
  api: ExcalidrawImperativeAPI;
  onClose: () => void;
  initialTab?: Tab;
}) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const formulaInput = useRef<HTMLTextAreaElement>(null);
  const [editingFormula] = useState(() => {
    const selected = api
      .getSceneElements()
      .filter((element) => api.getAppState().selectedElementIds[element.id]);
    const element = selected.length === 1 ? selected[0] : null;
    return element?.type === "image" &&
      typeof element.customData?.liliFormula === "string"
      ? element
      : null;
  });
  const [tab, setTab] = useState<Tab>(editingFormula ? "formula" : initialTab);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [formula, setFormula] = useState(
    editingFormula
      ? String(editingFormula.customData!.liliFormula)
      : "x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}",
  );
  const [formulaPreview, setFormulaPreview] = useState("");
  const [formulaError, setFormulaError] = useState("");
  const [expression, setExpression] = useState("x^2");
  const [min, setMin] = useState("-10");
  const [max, setMax] = useState("10");
  const [file, setFile] = useState<File | null>(null);
  const [first, setFirst] = useState("1");
  const [last, setLast] = useState("1");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    if (tab !== "formula") {
      return;
    }
    let cancelled = false;
    setFormulaPreview("");
    setFormulaError("");
    import("./formula")
      .then(({ formulaSVG }) => {
        const svg = formulaSVG(formula);
        if (!cancelled) {
          setFormulaPreview(svg);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setFormulaError(e.message || "Не удалось подготовить формулу.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [formula, tab]);
  let graphPreview = "";
  let graphError = "";
  try {
    if (!min.trim() || !max.trim()) {
      throw new Error("Укажите обе границы.");
    }
    graphPreview = graphSVG(expression, Number(min), Number(max));
  } catch (e) {
    graphError = (e as Error).message;
  }
  const doc = () => {
    const owner = dialog.current?.ownerDocument;
    if (!owner?.defaultView) {
      throw new Error("Окно доски недоступно.");
    }
    return owner;
  };
  const insert = async (
    images: {
      url: string;
      width: number;
      height: number;
      locked?: boolean;
      formula?: string;
    }[],
  ) => {
    const owner = doc();
    const win = owner.defaultView!;
    const state = api.getAppState();
    const x = state.width / 2 / state.zoom.value - state.scrollX;
    const existing = api.getSceneElements();
    let y = state.height / 2 / state.zoom.value - state.scrollY;
    if (existing.length) {
      y = Math.max(y, getCommonBounds(existing)[3] + 60);
    }
    const files: BinaryFileData[] = [];
    const skeletons = images.map((image) => {
      const fileId = win.crypto.randomUUID() as FileId;
      files.push({
        id: fileId,
        dataURL: image.url as DataURL,
        mimeType: image.url.startsWith("data:image/svg")
          ? "image/svg+xml"
          : "image/jpeg",
        created: Date.now(),
        lastRetrieved: Date.now(),
      });
      const item = {
        type: "image" as const,
        fileId,
        x: x - image.width / 2,
        y,
        width: image.width,
        height: image.height,
        status: "pending" as const,
        locked: !!image.locked,
        customData: image.formula ? { liliFormula: image.formula } : undefined,
      };
      y += image.height + 50;
      return item;
    });
    const elements = convertToExcalidrawElements(skeletons);
    api.addFiles(files);
    const current = api.getSceneElements();
    if (
      editingFormula &&
      images.length === 1 &&
      images[0].formula &&
      elements[0]?.type === "image"
    ) {
      const replacement = elements[0];
      api.updateScene({
        elements: current.map((element) =>
          element.id === editingFormula.id && element.type === "image"
            ? newElementWith(element, {
                fileId: replacement.fileId,
                width: replacement.width,
                height: replacement.height,
                status: "pending",
                customData: replacement.customData,
              })
            : element,
        ),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      return;
    }
    // PDF pages sit behind existing writing; other inserts sit on top.
    api.updateScene({
      appState: { selectedElementIds: {} },
      elements: images[0]?.locked
        ? [...elements, ...current]
        : [...current, ...elements],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    api.setViewport({
      target: elements[0],
      fit: "scale-down",
      animation: true,
    });
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      onClose();
    } catch (e) {
      setError(
        (e as Error).name === "PasswordException"
          ? "Этот PDF защищён паролем. Выберите файл без пароля."
          : (e as Error).message ||
              "Не удалось добавить материал. Попробуйте ещё раз.",
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  };
  const insertFormula = () =>
    run(async () => {
      if (!formulaPreview || formulaError) {
        throw new Error(formulaError || "Дождитесь предпросмотра.");
      }
      const win = doc().defaultView!;
      const parsed = new win.DOMParser().parseFromString(
        formulaPreview,
        "image/svg+xml",
      );
      const root = parsed.documentElement;
      const w = Math.max(
        24,
        parseFloat(root.getAttribute("width") || "10") * 18,
      );
      const h = Math.max(
        24,
        parseFloat(root.getAttribute("height") || "3") * 18,
      );
      root.setAttribute("width", String(Math.ceil(w)));
      root.setAttribute("height", String(Math.ceil(h)));
      const box = (root.getAttribute("viewBox") || "").split(/\s+/).map(Number);
      if (box.length === 4) {
        const background = parsed.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        for (const [key, value] of Object.entries({
          x: box[0],
          y: box[1],
          width: box[2],
          height: box[3],
          fill: "#fffdf7",
        })) {
          background.setAttribute(key, String(value));
        }
        root.insertBefore(background, root.firstChild);
      }
      const svg = new win.XMLSerializer().serializeToString(root);
      await insert([{ url: svgURL(svg), width: w, height: h, formula }]);
    });
  const importPDF = () =>
    run(async () => {
      if (!file) {
        throw new Error("Выберите PDF-файл.");
      }
      const start = Number(first);
      const end = Number(last);
      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 1 ||
        end < start ||
        end - start >= 10
      ) {
        throw new Error("Выберите от 1 до 10 страниц за один раз.");
      }
      if (file.size > 25 * 1024 * 1024) {
        throw new Error("Выберите PDF размером до 25 МБ.");
      }
      setProgress("Открываю PDF…");
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = (
        await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
      ).default;
      const task = pdfjs.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
        isEvalSupported: false,
      });
      const pdf = await task.promise;
      try {
        if (end > pdf.numPages) {
          throw new Error(
            `В файле ${pdf.numPages} стр. Уменьшите последний номер.`,
          );
        }
        const images = [];
        for (let n = start; n <= end; n++) {
          setProgress(`Готовлю страницу ${n} из ${end}…`);
          const page = await pdf.getPage(n);
          const original = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({
            scale: Math.min(
              2,
              1800 / Math.max(original.width, original.height),
            ),
          });
          const canvas = doc().createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d");
          if (!context) {
            throw new Error("Не удалось открыть страницу PDF.");
          }
          await page.render({
            canvasContext: context,
            viewport,
            background: "rgb(255,255,255)",
          }).promise;
          const url = canvas.toDataURL("image/jpeg", 0.88);
          const width = Math.min(800, original.width);
          images.push({
            url,
            width,
            height: (width * original.height) / original.width,
            locked: true,
          });
          canvas.width = 0;
          canvas.height = 0;
          page.cleanup();
        }
        await insert(images);
      } finally {
        await pdf.destroy();
      }
    });
  const addTemplate = (value: string) => {
    const input = formulaInput.current;
    const start = input?.selectionStart ?? formula.length;
    const end = input?.selectionEnd ?? start;
    setFormula(formula.slice(0, start) + value + formula.slice(end));
    input?.focus();
  };
  return (
    <dialog
      ref={dialog}
      className="lili-math"
      aria-labelledby="lili-math-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) {
          onClose();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div className="lili-math__inside">
        <header>
          <div>
            <small>lili.math</small>
            <h2 id="lili-math-title">Математика на доске</h2>
          </div>
          <button aria-label="Закрыть" disabled={busy} onClick={onClose}>
            ×
          </button>
        </header>
        <div
          className="lili-math__tabs"
          role="tablist"
          aria-label="Инструменты"
        >
          {(
            [
              ["pdf", "PDF"],
              ["formula", "Формулы"],
              ["graph", "Графики"],
            ] as const
          ).map(([id, title]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              aria-controls={`math-panel-${id}`}
              id={`math-tab-${id}`}
              disabled={busy}
              onClick={() => {
                setTab(id);
                setError("");
              }}
            >
              {title}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`math-panel-${tab}`}
          aria-labelledby={`math-tab-${tab}`}
        >
          {tab === "pdf" && (
            <>
              <p>Добавь лист с заданиями и решайте прямо поверх него.</p>
              <label className="lili-math__upload">
                PDF-файл
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={busy}
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    setError("");
                  }}
                />
              </label>
              <div className="lili-math__row">
                <label>
                  С первой страницы
                  <input
                    type="number"
                    min="1"
                    value={first}
                    disabled={busy}
                    onChange={(e) => setFirst(e.target.value)}
                  />
                </label>
                <label>
                  По страницу
                  <input
                    type="number"
                    min="1"
                    value={last}
                    disabled={busy}
                    onChange={(e) => setLast(e.target.value)}
                  />
                </label>
              </div>
              <p className="lili-math__hint">
                До 10 страниц за раз, файл до 25 МБ. Страницы добавятся друг под
                другом и будут закреплены. Чтобы переместить страницу,
                разблокируй её через контекстное меню.
              </p>
              <button
                className="primary"
                disabled={busy || !file}
                onClick={importPDF}
              >
                Добавить страницы на доску
              </button>
            </>
          )}
          {tab === "formula" && (
            <>
              <p>
                Набери формулу или выбери заготовку. Буквы внутри фигурных
                скобок можно заменить.
              </p>
              <div className="lili-math__templates">
                {templates.map(([title, value]) => (
                  <button
                    key={title}
                    disabled={busy}
                    onClick={() => addTemplate(value)}
                  >
                    {title}
                  </button>
                ))}
              </div>
              <label>
                Формула (LaTeX)
                <textarea
                  ref={formulaInput}
                  value={formula}
                  maxLength={2000}
                  disabled={busy}
                  onChange={(e) => setFormula(e.target.value)}
                  spellCheck={false}
                />
              </label>
              <div className="lili-math__preview" aria-live="polite">
                {formulaPreview ? (
                  <img
                    src={svgURL(formulaPreview)}
                    alt="Предпросмотр формулы"
                  />
                ) : (
                  <span>{formulaError || "Готовлю предпросмотр…"}</span>
                )}
              </div>
              <p className="lili-math__hint">
                Формула добавится как чёткое векторное изображение. Её можно
                перемещать и менять размер. Для изменения выдели формулу и снова
                открой «Математика».
              </p>
              <button
                className="primary"
                disabled={busy || !formulaPreview}
                onClick={insertFormula}
              >
                {editingFormula ? "Изменить формулу" : "Добавить формулу"}
              </button>
            </>
          )}
          {tab === "graph" && (
            <>
              <label>
                y =
                <input
                  value={expression}
                  maxLength={300}
                  disabled={busy}
                  onChange={(e) => setExpression(e.target.value)}
                  spellCheck={false}
                />
              </label>
              <div className="lili-math__templates">
                {["2x+1", "x^2", "1/x", "sqrt(x)", "abs(x)", "sin(x)"].map(
                  (value) => (
                    <button
                      key={value}
                      disabled={busy}
                      onClick={() => setExpression(value)}
                    >
                      {value}
                    </button>
                  ),
                )}
              </div>
              <div className="lili-math__row">
                <label>
                  Оси от
                  <input
                    type="number"
                    value={min}
                    disabled={busy}
                    onChange={(e) => setMin(e.target.value)}
                  />
                </label>
                <label>
                  До
                  <input
                    type="number"
                    value={max}
                    disabled={busy}
                    onChange={(e) => setMax(e.target.value)}
                  />
                </label>
              </div>
              <p className="lili-math__hint">
                Одинаковый масштаб по обеим осям. Степень: x^2, корень: sqrt(x),
                модуль: abs(x). Углы в радианах.
              </p>
              <div className="lili-math__preview graph">
                {graphPreview ? (
                  <img
                    src={svgURL(graphPreview)}
                    alt={`График y=${expression}`}
                  />
                ) : (
                  <span>{graphError}</span>
                )}
              </div>
              <p className="lili-math__hint">
                На доску добавится изображение графика. Чтобы построить другую
                функцию, снова открой «Графики».
              </p>
              <button
                className="primary"
                disabled={busy || !graphPreview}
                onClick={() =>
                  run(async () => {
                    const svg = graphSVG(expression, Number(min), Number(max));
                    await insert([
                      { url: svgURL(svg), width: 600, height: 600 },
                    ]);
                  })
                }
              >
                Добавить график
              </button>
            </>
          )}
        </div>
        {busy && <p role="status">{progress || "Добавляю на доску…"}</p>}
        {error && (
          <p className="lili-math__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </dialog>
  );
};
