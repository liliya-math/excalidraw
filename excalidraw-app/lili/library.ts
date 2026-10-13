// lili.math: ready-made library items for lessons — mascot stickers and
// math templates (coordinate plane, grid paper, figures, "Дано / Найти").

import { convertToExcalidrawElements } from "@excalidraw/excalidraw";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element/transform";
import type { LibraryItem, LibraryItems } from "@excalidraw/excalidraw/types";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { STICKERS, stickerFileId } from "./builtinFiles";

const CHALK = "#f3ece2";
const BUTTER = "#f5dc6a";
const APRICOT = "#f2905e";

// fixed timestamp so the built-in items keep a stable order
const CREATED = Date.UTC(2026, 9, 13);

const base = {
  strokeColor: CHALK,
  backgroundColor: "transparent",
  strokeWidth: 2,
  roughness: 0,
} as const;

const text = (
  x: number,
  y: number,
  value: string,
  extra: Record<string, unknown> = {},
): ExcalidrawElementSkeleton => ({
  type: "text",
  x,
  y,
  text: value,
  fontSize: 20,
  strokeColor: CHALK,
  ...extra,
});

const size = (points: [number, number][]) => {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
};

const line = (
  x: number,
  y: number,
  points: [number, number][],
  extra: Record<string, unknown> = {},
): ExcalidrawElementSkeleton =>
  ({
    type: "line",
    x,
    y,
    points,
    ...size(points),
    ...base,
    ...extra,
  } as unknown as ExcalidrawElementSkeleton);

const arrow = (
  x: number,
  y: number,
  points: [number, number][],
): ExcalidrawElementSkeleton =>
  ({
    type: "arrow",
    x,
    y,
    points,
    ...size(points),
    ...base,
    endArrowhead: "triangle",
    startArrowhead: null,
  } as unknown as ExcalidrawElementSkeleton);

const grid = (cols: number, rows: number, cell: number, opacity: number) => {
  const out: ExcalidrawElementSkeleton[] = [];
  for (let i = 0; i <= cols; i++) {
    out.push(
      line(i * cell, 0, [
        [0, 0],
        [0, rows * cell],
      ], { strokeWidth: 1, opacity }),
    );
  }
  for (let j = 0; j <= rows; j++) {
    out.push(
      line(0, j * cell, [
        [0, 0],
        [cols * cell, 0],
      ], { strokeWidth: 1, opacity }),
    );
  }
  return out;
};

const coordinatePlane = (): ExcalidrawElementSkeleton[] => {
  const cell = 30;
  const n = 12;
  const size = n * cell;
  const mid = size / 2;
  return [
    ...grid(n, n, cell, 22),
    arrow(-10, mid, [
      [0, 0],
      [size + 30, 0],
    ]),
    arrow(mid, size + 10, [
      [0, 0],
      [0, -(size + 30)],
    ]),
    text(size + 12, mid + 6, "x"),
    text(mid + 10, -34, "y"),
    text(mid - 20, mid + 4, "O"),
    text(mid + cell - 5, mid + 4, "1", { fontSize: 16 }),
    text(mid - 18, mid - cell - 10, "1", { fontSize: 16 }),
    line(mid + cell, mid - 5, [
      [0, 0],
      [0, 10],
    ]),
    line(mid - 5, mid - cell, [
      [0, 0],
      [10, 0],
    ]),
  ];
};

const gridPaper = (): ExcalidrawElementSkeleton[] => grid(12, 10, 30, 35);

const numberLine = (): ExcalidrawElementSkeleton[] => {
  const step = 40;
  const out: ExcalidrawElementSkeleton[] = [
    arrow(0, 0, [
      [0, 0],
      [step * 12, 0],
    ]),
  ];
  for (let i = 1; i <= 11; i++) {
    out.push(
      line(i * step, -7, [
        [0, 0],
        [0, 14],
      ]),
    );
  }
  out.push(text(5 * step - 5, 14, "0"), text(6 * step - 5, 14, "1"));
  out.push(text(step * 12 - 4, 10, "x"));
  return out;
};

const polygon = (
  pts: [number, number][],
  labels: { t: string; dx: number; dy: number }[],
): ExcalidrawElementSkeleton[] => [
  line(0, 0, [...pts, pts[0]]),
  ...labels.map((l, i) => text(pts[i][0] + l.dx, pts[i][1] + l.dy, l.t)),
];

const triangle = () =>
  polygon(
    [
      [0, 170],
      [240, 170],
      [90, 0],
    ],
    [
      { t: "A", dx: -22, dy: -6 },
      { t: "B", dx: 8, dy: -6 },
      { t: "C", dx: -6, dy: -30 },
    ],
  );

const rightTriangle = (): ExcalidrawElementSkeleton[] => [
  ...polygon(
    [
      [0, 170],
      [240, 170],
      [0, 0],
    ],
    [
      { t: "C", dx: -24, dy: -4 },
      { t: "B", dx: 8, dy: -6 },
      { t: "A", dx: -8, dy: -30 },
    ],
  ),
  line(0, 150, [
    [0, 0],
    [20, 0],
    [20, 20],
  ]),
];

const circle = (): ExcalidrawElementSkeleton[] => [
  { type: "ellipse", x: 0, y: 0, width: 220, height: 220, ...base },
  {
    type: "ellipse",
    x: 106,
    y: 106,
    width: 8,
    height: 8,
    ...base,
    backgroundColor: CHALK,
    fillStyle: "solid",
  } as ExcalidrawElementSkeleton,
  line(110, 110, [
    [0, 0],
    [110, 0],
  ]),
  text(96, 116, "O"),
  text(156, 82, "R"),
];

const trapezoid = () =>
  polygon(
    [
      [0, 140],
      [280, 140],
      [210, 0],
      [70, 0],
    ],
    [
      { t: "A", dx: -22, dy: -6 },
      { t: "D", dx: 8, dy: -6 },
      { t: "C", dx: 6, dy: -28 },
      { t: "B", dx: -20, dy: -28 },
    ],
  );

const parallelogram = () =>
  polygon(
    [
      [0, 140],
      [240, 140],
      [310, 0],
      [70, 0],
    ],
    [
      { t: "A", dx: -22, dy: -6 },
      { t: "D", dx: 8, dy: -6 },
      { t: "C", dx: 6, dy: -28 },
      { t: "B", dx: -20, dy: -28 },
    ],
  );

const givenFind = (): ExcalidrawElementSkeleton[] => [
  text(10, 0, "Дано:", { strokeColor: BUTTER }),
  text(10, 140, "Найти:", { strokeColor: BUTTER }),
  text(250, 0, "Решение:", { strokeColor: BUTTER }),
  text(250, 240, "Ответ:", { strokeColor: APRICOT }),
  line(0, 128, [
    [0, 0],
    [220, 0],
  ]),
  line(220, -6, [
    [0, 0],
    [0, 200],
  ]),
];

const sticker = (key: string): ExcalidrawElementSkeleton =>
  ({
    type: "image",
    x: 0,
    y: 0,
    width: 120,
    height: 120,
    fileId: stickerFileId(key),
    status: "saved",
    strokeColor: "transparent",
  } as unknown as ExcalidrawElementSkeleton);

const TEMPLATES: { id: string; name: string; build: () => ExcalidrawElementSkeleton[] }[] = [
  { id: "coord", name: "Координатная плоскость", build: coordinatePlane },
  { id: "grid", name: "Клетчатое поле", build: gridPaper },
  { id: "numline", name: "Числовая прямая", build: numberLine },
  { id: "given", name: "Дано / Найти / Решение", build: givenFind },
  { id: "triangle", name: "Треугольник ABC", build: triangle },
  { id: "right-triangle", name: "Прямоугольный треугольник", build: rightTriangle },
  { id: "circle", name: "Окружность с центром O", build: circle },
  { id: "trapezoid", name: "Трапеция ABCD", build: trapezoid },
  { id: "parallelogram", name: "Параллелограмм ABCD", build: parallelogram },
];

const toItem = (
  id: string,
  name: string,
  skeletons: ExcalidrawElementSkeleton[],
  order: number,
): LibraryItem => ({
  id: `lili-${id}`,
  name,
  status: "unpublished",
  created: CREATED - order,
  elements: convertToExcalidrawElements(skeletons, {
    regenerateIds: true,
  }) as NonDeletedExcalidrawElement[],
});

export const buildLiliLibrary = (): LibraryItems => {
  const items: LibraryItem[] = [];
  let order = 0;
  for (const s of STICKERS) {
    items.push(toItem(`sticker-${s.key}`, s.title, [sticker(s.key)], order++));
  }
  for (const t of TEMPLATES) {
    items.push(toItem(`tpl-${t.id}`, t.name, t.build(), order++));
  }
  return items;
};
