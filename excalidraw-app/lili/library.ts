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

const SAGE = "#a9d18e";
const SKY = "#9db8ff";
const MISS = "#ff8f73";

const rect = (
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Record<string, unknown> = {},
): ExcalidrawElementSkeleton =>
  ({
    type: "rectangle",
    x,
    y,
    width: w,
    height: h,
    ...base,
    ...extra,
  } as unknown as ExcalidrawElementSkeleton);

const dot = (
  cx: number,
  cy: number,
  r = 4,
  extra: Record<string, unknown> = {},
): ExcalidrawElementSkeleton =>
  ({
    type: "ellipse",
    x: cx - r,
    y: cy - r,
    width: r * 2,
    height: r * 2,
    ...base,
    backgroundColor: CHALK,
    fillStyle: "solid",
    ...extra,
  } as unknown as ExcalidrawElementSkeleton);

const curve = (
  points: [number, number][],
  extra: Record<string, unknown> = {},
): ExcalidrawElementSkeleton =>
  ({
    type: "draw",
    x: 0,
    y: 0,
    points,
    ...size(points),
    ...base,
    ...extra,
  } as unknown as ExcalidrawElementSkeleton);

const arc = (
  cx: number,
  cy: number,
  r: number,
  a1: number,
  a2: number,
): ExcalidrawElementSkeleton => {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const t = a1 + ((a2 - a1) * i) / 12;
    pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return curve(pts);
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

// ---- new templates (lili.math) ----

const fraction = (): ExcalidrawElementSkeleton[] => [
  text(14, -48, "3", { fontSize: 32 }),
  line(0, -8, [
    [0, 0],
    [48, 0],
  ]),
  text(14, 2, "8", { fontSize: 32 }),
];

const dataTable = (): ExcalidrawElementSkeleton[] => {
  const w = 240,
    h = 120,
    rh = 30,
    cw = 80;
  const out: ExcalidrawElementSkeleton[] = [
    rect(0, 0, w, h, { strokeWidth: 1 }),
  ];
  for (let i = 1; i < 3; i++) {
    out.push(
      line(i * cw, 0, [
        [0, 0],
        [0, h],
      ], { strokeWidth: 1 }),
    );
  }
  for (let j = 1; j < 4; j++) {
    out.push(
      line(0, j * rh, [
        [0, 0],
        [w, 0],
      ], { strokeWidth: 1 }),
    );
  }
  return out;
};

const angleBAC = (): ExcalidrawElementSkeleton[] => {
  const b: [number, number] = [150, -80];
  const c: [number, number] = [190, 15];
  return [
    line(0, 0, [
      [0, 0],
      b,
    ]),
    line(0, 0, [
      [0, 0],
      c,
    ]),
    arc(0, 0, 52, Math.atan2(b[1], b[0]), Math.atan2(c[1], c[0])),
    text(-22, -10, "A"),
    text(b[0] + 6, b[1] - 12, "B"),
    text(c[0] + 8, c[1] - 2, "C"),
  ];
};

const squareABCD = () =>
  polygon(
    [
      [0, 0],
      [150, 0],
      [150, 150],
      [0, 150],
    ],
    [
      { t: "A", dx: -22, dy: -6 },
      { t: "B", dx: 8, dy: -6 },
      { t: "C", dx: 8, dy: -6 },
      { t: "D", dx: -22, dy: -6 },
    ],
  );

const segmentAB = (): ExcalidrawElementSkeleton[] => [
  line(0, 0, [
    [0, 0],
    [220, 0],
  ], { strokeWidth: 3 }),
  dot(0, 0),
  dot(220, 0),
  text(-26, -10, "A"),
  text(228, -10, "B"),
];

const triangleHeight = (): ExcalidrawElementSkeleton[] => [
  ...polygon(
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
  ),
  line(90, 0, [
    [0, 0],
    [0, 170],
  ], { strokeStyle: "dashed" }),
  line(90, 150, [
    [0, 0],
    [20, 0],
    [20, 20],
  ]),
  text(96, 60, "h", { fontSize: 16 }),
];

const inscribedAngle = (): ExcalidrawElementSkeleton[] => {
  const cx = 110,
    cy = 110,
    r = 110;
  const pt = (deg: number): [number, number] => [
    cx + r * Math.cos((deg * Math.PI) / 180),
    cy + r * Math.sin((deg * Math.PI) / 180),
  ];
  const a = pt(-90),
    b = pt(180),
    c = pt(35);
  return [
    {
      type: "ellipse",
      x: 0,
      y: 0,
      width: 220,
      height: 220,
      ...base,
    } as unknown as ExcalidrawElementSkeleton,
    dot(cx, cy),
    text(cx + 8, cy + 6, "O"),
    line(b[0], b[1], [
      [0, 0],
      [c[0] - b[0], c[1] - b[1]],
    ]),
    line(a[0], a[1], [
      [0, 0],
      [b[0] - a[0], b[1] - a[1]],
    ]),
    line(a[0], a[1], [
      [0, 0],
      [c[0] - a[0], c[1] - a[1]],
    ]),
    dot(a[0], a[1]),
    dot(b[0], b[1]),
    dot(c[0], c[1]),
    text(a[0] - 4, a[1] - 26, "A"),
    text(b[0] - 24, b[1] - 6, "B"),
    text(c[0] + 8, c[1] - 4, "C"),
  ];
};

const eulerCircles = (): ExcalidrawElementSkeleton[] => [
  {
    type: "ellipse",
    x: 0,
    y: 0,
    width: 170,
    height: 115,
    ...base,
    strokeColor: BUTTER,
  } as unknown as ExcalidrawElementSkeleton,
  {
    type: "ellipse",
    x: 120,
    y: 0,
    width: 170,
    height: 115,
    ...base,
    strokeColor: SKY,
  } as unknown as ExcalidrawElementSkeleton,
  text(28, 18, "A", { strokeColor: BUTTER }),
  text(238, 18, "B", { strokeColor: SKY }),
];

const probabilityTree = (): ExcalidrawElementSkeleton[] => {
  const nodes: [number, number][] = [
    [110, 0],
    [40, 130],
    [180, 130],
    [0, 260],
    [80, 260],
    [140, 260],
    [220, 260],
  ];
  const edges: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 3],
    [1, 4],
    [2, 5],
    [2, 6],
  ];
  const out: ExcalidrawElementSkeleton[] = edges.map(([f, t]) =>
    line(nodes[f][0] + 4, nodes[f][1] + 4, [
      [0, 0],
      [nodes[t][0] - nodes[f][0], nodes[t][1] - nodes[f][1]],
    ], { strokeWidth: 1 }),
  );
  nodes.forEach((n) => out.push(dot(n[0], n[1], 5)));
  out.push(
    text(48, 52, "0,5", { fontSize: 16 }),
    text(142, 52, "0,5", { fontSize: 16 }),
  );
  return out;
};

const barChart = (): ExcalidrawElementSkeleton[] => [
  line(0, 200, [
    [0, 0],
    [280, 0],
  ], { strokeWidth: 2 }),
  line(0, 0, [
    [0, 0],
    [0, 200],
  ], { strokeWidth: 2 }),
  rect(40, 80, 50, 120, {
    backgroundColor: SAGE,
    fillStyle: "solid",
    strokeWidth: 1,
  }),
  rect(120, 120, 50, 80, {
    backgroundColor: BUTTER,
    fillStyle: "solid",
    strokeWidth: 1,
  }),
  rect(200, 40, 50, 160, {
    backgroundColor: MISS,
    fillStyle: "solid",
    strokeWidth: 1,
  }),
];

const numberLineFull = (): ExcalidrawElementSkeleton[] => {
  const step = 40,
    len = step * 11;
  const out: ExcalidrawElementSkeleton[] = [
    {
      type: "arrow",
      x: 0,
      y: 0,
      points: [
        [0, 0],
        [len, 0],
      ],
      width: len,
      height: 0,
      ...base,
      startArrowhead: "triangle",
      endArrowhead: "triangle",
    } as unknown as ExcalidrawElementSkeleton,
  ];
  for (let i = 1; i <= 10; i++) {
    out.push(
      line(i * step, -7, [
        [0, 0],
        [0, 14],
      ]),
    );
  }
  for (let v = -3; v <= 3; v++) {
    out.push(
      text((v + 5) * step - (v < 0 ? 10 : 5), 16, String(v), { fontSize: 16 }),
    );
  }
  out.push(text(len + 8, -6, "x"));
  return out;
};

const graphLine = (): ExcalidrawElementSkeleton[] => [
  line(0, 60, [
    [0, 0],
    [220, -120],
  ], { strokeWidth: 2 }),
  text(150, 10, "y = kx + m", { fontSize: 18 }),
];

const graphParabola = (): ExcalidrawElementSkeleton[] => {
  const pts: [number, number][] = [];
  for (let x = -90; x <= 90; x += 10) {
    pts.push([x, (x * x) / 70]);
  }
  return [curve(pts, { strokeWidth: 2 }), text(60, 128, "y = x²", { fontSize: 18 })];
};

const graphHyperbola = (): ExcalidrawElementSkeleton[] => {
  const b1: [number, number][] = [];
  const b2: [number, number][] = [];
  for (let x = 14; x <= 140; x += 8) {
    b1.push([x, 900 / x]);
    b2.push([-x, -900 / x]);
  }
  return [
    curve(b1, { strokeWidth: 2 }),
    curve(b2, { strokeWidth: 2 }),
    text(30, 150, "y = k/x", { fontSize: 18 }),
  ];
};

const quadraticCard = (): ExcalidrawElementSkeleton[] => [
  text(0, 0, "ax² + bx + c = 0", { fontSize: 28 }),
  text(0, 48, "D = b² - 4ac", { fontSize: 24, strokeColor: BUTTER }),
];

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
  { id: "numline-full", name: "Числовая прямая с отрицательными", build: numberLineFull },
  { id: "given", name: "Дано / Найти / Решение", build: givenFind },
  { id: "fraction", name: "Дробь", build: fraction },
  { id: "table", name: "Таблица 3×4", build: dataTable },
  { id: "quadratic", name: "Квадратное уравнение", build: quadraticCard },
  { id: "triangle", name: "Треугольник ABC", build: triangle },
  { id: "right-triangle", name: "Прямоугольный треугольник", build: rightTriangle },
  { id: "triangle-height", name: "Высота треугольника", build: triangleHeight },
  { id: "circle", name: "Окружность с центром O", build: circle },
  { id: "inscribed", name: "Вписанный угол", build: inscribedAngle },
  { id: "trapezoid", name: "Трапеция ABCD", build: trapezoid },
  { id: "parallelogram", name: "Параллелограмм ABCD", build: parallelogram },
  { id: "square", name: "Квадрат ABCD", build: squareABCD },
  { id: "segment", name: "Отрезок AB", build: segmentAB },
  { id: "angle", name: "Угол BAC", build: angleBAC },
  { id: "euler", name: "Круги Эйлера", build: eulerCircles },
  { id: "prob-tree", name: "Дерево вероятностей", build: probabilityTree },
  { id: "bars", name: "Столбчатая диаграмма", build: barChart },
  { id: "graph-line", name: "График: прямая", build: graphLine },
  { id: "graph-parabola", name: "График: парабола", build: graphParabola },
  { id: "graph-hyperbola", name: "График: гипербола", build: graphHyperbola },
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
