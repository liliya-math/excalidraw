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

// ---- templates for grades 5–8 (lili.math) ----

const rectangleABCD = () =>
  polygon(
    [
      [0, 0],
      [240, 0],
      [240, 140],
      [0, 140],
    ],
    [
      { t: "A", dx: -22, dy: -6 },
      { t: "B", dx: 8, dy: -6 },
      { t: "C", dx: 8, dy: -6 },
      { t: "D", dx: -22, dy: -6 },
    ],
  );

const mixedNumber = (): ExcalidrawElementSkeleton[] => [
  text(0, -8, "2", { fontSize: 32 }),
  text(50, -48, "3", { fontSize: 32 }),
  line(36, -8, [
    [0, 0],
    [44, 0],
  ]),
  text(50, 2, "8", { fontSize: 32 }),
];

const powerCard = (): ExcalidrawElementSkeleton[] => [
  text(0, 0, "a² = a · a", { fontSize: 28 }),
  text(0, 48, "a³ = a · a · a", { fontSize: 28 }),
];

const divisionRemainder = (): ExcalidrawElementSkeleton[] => [
  text(0, 0, "17 : 5 = 3 (ост. 2)", { fontSize: 28 }),
];

const cube = (): ExcalidrawElementSkeleton[] => {
  const s = 140;
  const o = 50;
  const f: [number, number][] = [
    [0, 0],
    [s, 0],
    [s, s],
    [0, s],
  ];
  const b: [number, number][] = f.map(([x, y]) => [x + o, y - o]);
  const edge = (
    p: [number, number],
    q: [number, number],
    extra: Record<string, unknown> = {},
  ) =>
    line(p[0], p[1], [
      [0, 0],
      [q[0] - p[0], q[1] - p[1]],
    ], extra);
  return [
    // hidden edges (back-left, back-bottom, two rear connectors)
    edge(b[3], b[0], { strokeStyle: "dashed" }),
    edge(b[2], b[3], { strokeStyle: "dashed" }),
    edge(f[3], b[3], { strokeStyle: "dashed" }),
    edge(f[2], b[2], { strokeStyle: "dashed" }),
    // visible back edges
    edge(b[0], b[1]),
    edge(b[1], b[2]),
    // front-to-back connectors
    edge(f[0], b[0]),
    edge(f[1], b[1]),
    // front square
    edge(f[0], f[1]),
    edge(f[1], f[2]),
    edge(f[2], f[3]),
    edge(f[3], f[0]),
  ];
};

const pieChart = (): ExcalidrawElementSkeleton[] => {
  const r = 110;
  const pts: [number, number][] = [
    [0, 0],
    [0, -r],
  ];
  for (let i = 1; i <= 9; i++) {
    const t = -Math.PI / 2 + (Math.PI / 2) * (i / 9);
    pts.push([r * Math.cos(t), r * Math.sin(t)]);
  }
  pts.push([r, 0]);
  return [
    {
      type: "ellipse",
      x: -r,
      y: -r,
      width: r * 2,
      height: r * 2,
      ...base,
    } as unknown as ExcalidrawElementSkeleton,
    curve(pts, { backgroundColor: BUTTER, fillStyle: "solid" }),
    text(r + 16, -10, "25 %", { fontSize: 18 }),
  ];
};

const proportion = (): ExcalidrawElementSkeleton[] => [
  text(0, 0, "a : b = c : d", { fontSize: 28 }),
  text(0, 44, "крайние: a и d", { fontSize: 16, strokeColor: SAGE }),
  text(0, 68, "средние: b и c", { fontSize: 16, strokeColor: SKY }),
  text(0, 108, "ad = bc", { fontSize: 24, strokeColor: BUTTER }),
];

const moduleLine = (): ExcalidrawElementSkeleton[] => {
  const step = 40;
  const at = (v: number) => (v + 5) * step;
  return [
    ...numberLineFull(),
    dot(at(-2), -16, 4),
    dot(at(2), -16, 4),
    text(at(-2) - 5, -44, "A", { fontSize: 16 }),
    text(at(2) - 5, -44, "B", { fontSize: 16 }),
    text(0, 64, "|AB| = |x₂ - x₁|", { fontSize: 22 }),
  ];
};

const coordPoint = (): ExcalidrawElementSkeleton[] => {
  const cell = 30;
  const mid = (12 * cell) / 2;
  const px = mid + 3 * cell;
  const py = mid - 2 * cell;
  return [
    ...coordinatePlane(),
    dot(px, py, 5, { backgroundColor: APRICOT }),
    text(px + 12, py - 26, "A (3; 2)", { strokeColor: APRICOT }),
  ];
};

const anglesCross = (): ExcalidrawElementSkeleton[] => {
  const t1 = Math.atan2(80, 140);
  const t2 = Math.atan2(-60, 140);
  const m1 = (t1 + t2) / 2;
  const m2 = (t1 + t2 + Math.PI) / 2;
  const r = 52;
  const at = (m: number): [number, number] => [
    r * Math.cos(m) - 4,
    r * Math.sin(m) - 8,
  ];
  return [
    line(0, 0, [
      [0, 0],
      [140, 80],
    ]),
    line(0, 0, [
      [0, 0],
      [-140, -80],
    ]),
    line(0, 0, [
      [0, 0],
      [140, -60],
    ]),
    line(0, 0, [
      [0, 0],
      [-140, 60],
    ]),
    arc(0, 0, 30, t2, t1),
    arc(0, 0, 30, t1, t2 + Math.PI),
    arc(0, 0, 30, t2 + Math.PI, t1 + Math.PI),
    arc(0, 0, 30, t1 + Math.PI, t2 + 2 * Math.PI),
    text(...at(m1), "1", { fontSize: 16 }),
    text(...at(m2), "2", { fontSize: 16 }),
    text(...at(m1 + Math.PI), "3", { fontSize: 16 }),
    text(...at(m2 + Math.PI), "4", { fontSize: 16 }),
  ];
};

const angleBisector = (): ExcalidrawElementSkeleton[] => {
  const b: [number, number] = [150, -80];
  const c: [number, number] = [190, 15];
  const d: [number, number] = [147, -31];
  const tb = Math.atan2(b[1], b[0]);
  const tc = Math.atan2(c[1], c[0]);
  const td = Math.atan2(d[1], d[0]);
  return [
    line(0, 0, [
      [0, 0],
      b,
    ]),
    line(0, 0, [
      [0, 0],
      c,
    ]),
    line(0, 0, [
      [0, 0],
      d,
    ], { strokeStyle: "dashed" }),
    arc(0, 0, 40, tb, td),
    arc(0, 0, 40, td, tc),
    text(-22, -10, "A"),
    text(b[0] + 6, b[1] - 12, "B"),
    text(c[0] + 8, c[1] - 2, "C"),
    text(d[0] + 2, d[1] - 26, "D"),
  ];
};

const parallelSecant = (): ExcalidrawElementSkeleton[] => [
  arrow(-20, -50, [
    [0, 0],
    [280, 0],
  ]),
  arrow(-20, 70, [
    [0, 0],
    [280, 0],
  ]),
  arrow(-30, 110, [
    [0, 0],
    [300, -240],
  ]),
  text(-14, -84, "a", { fontSize: 18 }),
  text(-14, 84, "b", { fontSize: 18 }),
  text(188, -80, "1", { fontSize: 16 }),
  text(140, -72, "2", { fontSize: 16 }),
  text(40, 42, "3", { fontSize: 16 }),
  text(-2, 96, "4", { fontSize: 16 }),
];

const equationSystem = (): ExcalidrawElementSkeleton[] => [
  curve(
    [
      [0, 0],
      [-10, 6],
      [-18, 16],
      [-20, 25],
      [-24, 50],
      [-20, 75],
      [-18, 84],
      [-10, 94],
      [0, 100],
    ],
    { strokeWidth: 2 },
  ),
  text(8, 4, "x + y = 5", { fontSize: 24 }),
  text(8, 56, "2x - y = 1", { fontSize: 24 }),
];

const pythagoras = (): ExcalidrawElementSkeleton[] => [
  ...rightTriangle(),
  text(112, 196, "a", { fontSize: 20 }),
  text(-34, 80, "b", { fontSize: 20 }),
  text(140, 56, "c", { fontSize: 20 }),
  text(280, 30, "c² = a² + b²", { fontSize: 24, strokeColor: BUTTER }),
];

const circleTangent = (): ExcalidrawElementSkeleton[] => [
  {
    type: "ellipse",
    x: 0,
    y: 0,
    width: 220,
    height: 220,
    ...base,
  } as unknown as ExcalidrawElementSkeleton,
  line(-20, 0, [
    [0, 0],
    [260, 0],
  ]),
  line(110, 110, [
    [0, 0],
    [0, -110],
  ], { strokeStyle: "dashed" }),
  line(110, 22, [
    [0, 0],
    [22, 0],
    [22, 22],
  ]),
  dot(110, 110, 4),
  dot(110, 0, 4),
  text(118, 116, "O"),
  text(118, -26, "T"),
  text(-44, -24, "t", { fontSize: 18 }),
];

const trigRight = (): ExcalidrawElementSkeleton[] => [
  ...rightTriangle(),
  text(196, 138, "α", { fontSize: 20 }),
  text(112, 196, "a", { fontSize: 20 }),
  text(-34, 80, "b", { fontSize: 20 }),
  text(140, 56, "c", { fontSize: 20 }),
  text(280, 0, "sin α = a / c", { fontSize: 20 }),
  text(280, 36, "cos α = b / c", { fontSize: 20 }),
  text(280, 72, "tg α = a / b", { fontSize: 20 }),
];

const graphSqrt = (): ExcalidrawElementSkeleton[] => {
  const pts: [number, number][] = [];
  for (let x = 4; x <= 140; x += 8) {
    pts.push([x, -14 * Math.sqrt(x)]);
  }
  return [
    curve(pts, { strokeWidth: 2 }),
    text(60, -170, "y = √x", { fontSize: 18 }),
  ];
};

// ---- templates grown from the 6th-grade diagnostic (lili.math) ----

const motionDiagram = (): ExcalidrawElementSkeleton[] => [
  line(0, 80, [
    [0, 0],
    [320, 0],
  ], { strokeWidth: 3 }),
  dot(0, 80),
  dot(320, 80),
  text(-26, 70, "A"),
  text(330, 70, "B"),
  arrow(14, 56, [
    [0, 0],
    [84, 0],
  ]),
  text(38, 30, "v₁", { fontSize: 18 }),
  arrow(306, 56, [
    [0, 0],
    [-84, 0],
  ]),
  text(264, 30, "v₂", { fontSize: 18 }),
  line(0, 112, [
    [0, 0],
    [320, 0],
  ], { strokeStyle: "dashed" }),
  line(0, 106, [
    [0, 0],
    [0, 12],
  ]),
  line(320, 106, [
    [0, 0],
    [0, 12],
  ]),
  text(152, 122, "S", { fontSize: 18 }),
];

const factorTree = (): ExcalidrawElementSkeleton[] => {
  const prime = { strokeColor: APRICOT, fontSize: 20 };
  const br = (x1: number, y1: number, x2: number, y2: number) =>
    line(x1, y1, [
      [0, 0],
      [x2 - x1, y2 - y1],
    ], { strokeWidth: 1 });
  return [
    text(94, -6, "36", { fontSize: 24 }),
    br(110, 28, 60, 64),
    br(110, 28, 160, 64),
    text(48, 58, "4", { fontSize: 22 }),
    text(154, 58, "9", { fontSize: 22 }),
    br(60, 86, 34, 118),
    br(60, 86, 68, 118),
    br(160, 86, 142, 118),
    br(160, 86, 176, 118),
    text(24, 112, "2", prime),
    text(58, 112, "2", prime),
    text(132, 112, "3", prime),
    text(166, 112, "3", prime),
  ];
};

const powerLine = (): ExcalidrawElementSkeleton[] => [
  text(0, 0, "aⁿ = a · a · … · a · a", { fontSize: 28 }),
  text(0, 48, "2⁵ = 2 · 2 · 2 · 2 · 2 = 32", { fontSize: 20 }),
  text(0, 86, "n — показатель: сколько раз умножаем", {
    fontSize: 16,
    strokeColor: SAGE,
  }),
];

const circleFormulas = (): ExcalidrawElementSkeleton[] => [
  {
    type: "ellipse",
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    ...base,
  } as unknown as ExcalidrawElementSkeleton,
  dot(100, 100, 4),
  line(100, 100, [
    [0, 0],
    [100, 0],
  ]),
  text(140, 108, "R"),
  text(240, 30, "C = 2πR", { fontSize: 22 }),
  text(240, 74, "S = πR²", { fontSize: 22 }),
  text(240, 118, "π ≈ 3,14", { fontSize: 16, strokeColor: SAGE }),
];

const axialSymmetry = (): ExcalidrawElementSkeleton[] => {
  const ax = 150;
  const tri: [number, number][] = [
    [0, 20],
    [90, 0],
    [50, 100],
  ];
  const mir: [number, number][] = tri.map(([x, y]) => [2 * ax - x, y]);
  const poly = (
    pts: [number, number][],
    extra: Record<string, unknown> = {},
  ) =>
    line(
      pts[0][0],
      pts[0][1],
      [
        ...pts.map(
          (p) => [p[0] - pts[0][0], p[1] - pts[0][1]] as [number, number],
        ),
        [0, 0],
      ],
      extra,
    );
  return [
    line(ax, -20, [
      [0, 0],
      [0, 160],
    ], { strokeStyle: "dashed", strokeColor: BUTTER }),
    text(ax + 8, -18, "l", { strokeColor: BUTTER }),
    poly(tri),
    poly(mir, { strokeStyle: "dashed" }),
    text(-26, 12, "A"),
    text(96, -10, "B"),
    text(44, 96, "C"),
    text(mir[0][0] + 10, 12, "A′"),
    text(mir[1][0] - 30, -10, "B′"),
    text(mir[2][0] - 24, 96, "C′"),
    line(tri[0][0], tri[0][1], [
      [0, 0],
      [mir[0][0] - tri[0][0], 0],
    ], { strokeWidth: 1, strokeStyle: "dashed" }),
  ];
};

const solids3d = (): ExcalidrawElementSkeleton[] => {
  const bottomArc = (cx: number, y: number, r: number, ry: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 10; i++) {
      const t = (Math.PI * i) / 10;
      pts.push([cx - r * Math.cos(t), y + ry * Math.sin(t)]);
    }
    return pts;
  };
  const equator: [number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    const t = (2 * Math.PI * i) / 20;
    equator.push([300 + 40 * Math.cos(t), 45 + 13 * Math.sin(t)]);
  }
  return [
    // цилиндр
    {
      type: "ellipse",
      x: 0,
      y: 0,
      width: 80,
      height: 26,
      ...base,
    } as unknown as ExcalidrawElementSkeleton,
    line(0, 13, [
      [0, 0],
      [0, 70],
    ]),
    line(80, 13, [
      [0, 0],
      [0, 70],
    ]),
    curve(bottomArc(40, 83, 40, 13)),
    text(8, 112, "цилиндр", { fontSize: 14, strokeColor: SKY }),
    // конус
    line(170, 0, [
      [0, 0],
      [-40, 90],
    ]),
    line(170, 0, [
      [0, 0],
      [40, 90],
    ]),
    curve(bottomArc(170, 90, 40, 14)),
    text(146, 112, "конус", { fontSize: 14, strokeColor: SKY }),
    // шар
    {
      type: "ellipse",
      x: 260,
      y: 5,
      width: 80,
      height: 80,
      ...base,
    } as unknown as ExcalidrawElementSkeleton,
    curve(equator, { strokeStyle: "dashed" }),
    text(282, 112, "шар", { fontSize: 14, strokeColor: SKY }),
  ];
};

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
  { id: "graph-sqrt", name: "График: y = √x", build: graphSqrt },
  // 5 класс
  { id: "rectangle", name: "Прямоугольник ABCD", build: rectangleABCD },
  { id: "mixed-number", name: "Смешанная дробь", build: mixedNumber },
  { id: "powers", name: "Квадрат и куб числа", build: powerCard },
  { id: "remainder", name: "Деление с остатком", build: divisionRemainder },
  { id: "cube", name: "Куб", build: cube },
  { id: "pie", name: "Круговая диаграмма 25 %", build: pieChart },
  // 6 класс
  { id: "proportion", name: "Пропорция", build: proportion },
  { id: "module-line", name: "Модуль: расстояние на прямой", build: moduleLine },
  { id: "coord-point", name: "Точка A(3; 2) на плоскости", build: coordPoint },
  { id: "motion", name: "Движение: навстречу и вдогонку", build: motionDiagram },
  { id: "factor-tree", name: "Разложение на множители", build: factorTree },
  { id: "power-line", name: "Степень с показателем n", build: powerLine },
  { id: "circle-fs", name: "Окружность и круг: формулы", build: circleFormulas },
  { id: "symmetry", name: "Осевая симметрия", build: axialSymmetry },
  { id: "solids", name: "Цилиндр, конус, шар", build: solids3d },
  // 7 класс
  { id: "cross-angles", name: "Смежные и вертикальные углы", build: anglesCross },
  { id: "bisector", name: "Биссектриса угла", build: angleBisector },
  { id: "parallel", name: "Параллельные прямые и секущая", build: parallelSecant },
  { id: "system", name: "Система уравнений", build: equationSystem },
  // 8 класс
  { id: "pythagoras", name: "Теорема Пифагора", build: pythagoras },
  { id: "tangent", name: "Касательная к окружности", build: circleTangent },
  { id: "trig", name: "Синус, косинус, тангенс", build: trigRight },
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
