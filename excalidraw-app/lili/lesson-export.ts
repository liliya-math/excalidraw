import { exportToCanvas } from "@excalidraw/excalidraw";
import { newElementWith } from "@excalidraw/element";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { printableElements, lessonFrames } from "./lesson-model";

export const download = (doc: Document, blob: Blob, name: string) => {
  const win = doc.defaultView!;
  const url = win.URL.createObjectURL(blob);
  const a = doc.createElement("a");
  a.href = url;
  a.download = name;
  doc.body.append(a);
  a.click();
  a.remove();
  win.setTimeout(() => win.URL.revokeObjectURL(url), 30000);
};
export const exportLessonPDF = async (
  api: ExcalidrawImperativeAPI,
  doc: Document,
  frameIds: string[],
  squared: boolean,
) => {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const selected = frameIds.length
    ? frameIds
    : lessonFrames(api.getSceneElements()).map((e) => e.id);
  const batches = selected.length
    ? selected.map((id) => printableElements(api, id))
    : [printableElements(api)];
  for (const batch of batches) {
    if (!batch.length) {
      continue;
    }
    // Pale strokes from the dark board become readable ink for printing.
    const elements = batch.map((e) =>
      newElementWith(e, {
        strokeColor: /^#(?:f3ece2|fff(?:fff)?|ffffff|f8f9fa)$/i.test(
          e.strokeColor,
        )
          ? "#172b23"
          : e.strokeColor,
      }),
    );
    const canvas = await exportToCanvas({
      elements,
      files: api.getFiles(),
      appState: {
        ...api.getAppState(),
        exportWithDarkMode: false,
        exportBackground: !squared,
        viewBackgroundColor: "#ffffff",
        exportEmbedScene: false,
      },
      exportPadding: 15,
      maxWidthOrHeight: 2600,
    });
    const image = { width: canvas.width, height: canvas.height };
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const pad = 24;
    const scale = (pageWidth - pad * 2) / image.width;
    const height = image.height * scale;
    const available = pageHeight - pad * 2;
    const pages = Math.max(1, Math.ceil((height - 0.01) / available));
    for (let n = 0; n < pages; n++) {
      const page = pdf.addPage([pageWidth, pageHeight]);
      if (squared) {
        for (let x = pad; x < pageWidth - pad; x += 14.17) {
          page.drawLine({
            start: { x, y: pad },
            end: { x, y: pageHeight - pad },
            thickness: 0.25,
            color: rgb(0.84, 0.88, 0.86),
          });
        }
        for (let y = pad; y < pageHeight - pad; y += 14.17) {
          page.drawLine({
            start: { x: pad, y },
            end: { x: pageWidth - pad, y },
            thickness: 0.25,
            color: rgb(0.84, 0.88, 0.86),
          });
        }
      }
      // Crop in the source canvas to prevent content spilling into page margins.
      const cut = doc.createElement("canvas");
      cut.width = canvas.width;
      cut.height = Math.min(
        canvas.height - (n * available) / scale,
        available / scale,
      );
      const ctx = cut.getContext("2d")!;
      ctx.drawImage(
        canvas,
        0,
        (n * available) / scale,
        canvas.width,
        cut.height,
        0,
        0,
        cut.width,
        cut.height,
      );
      const section = await pdf.embedPng(cut.toDataURL("image/png"));
      const sectionHeight = section.height * scale;
      page.drawImage(section, {
        x: pad,
        y: pageHeight - pad - sectionHeight,
        width: pageWidth - pad * 2,
        height: sectionHeight,
      });
      cut.width = 0;
      cut.height = 0;
    }
    canvas.width = 0;
    canvas.height = 0;
  }
  if (!pdf.getPageCount()) {
    throw new Error("В выбранных областях пока нет записей.");
  }
  const bytes = await pdf.save();
  download(
    doc,
    new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }),
    "lili-lesson.pdf",
  );
};
