import type { ExcalidrawElementSkeleton } from "@excalidraw/element/transform";
export type GeometryTool =
  | "ruler"
  | "protractor"
  | "angle"
  | "perpendicular"
  | "circle"
  | "triangle"
  | "equal";
export const geometryElements = (
  tool: GeometryTool,
  value: number,
  x: number,
  y: number,
  group: string,
  frameId: string | null,
  cell = 30,
): ExcalidrawElementSkeleton[] => {
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    (tool === "angle" ? value > 180 : value > 30)
  ) {
    throw new Error(
      tool === "angle"
        ? "Укажи угол от 1 до 180°."
        : "Укажи размер от 0,1 до 30 клеток.",
    );
  }
  const unit = cell / 30;
  const common = {
    strokeColor: "#f3ece2",
    backgroundColor: "transparent",
    roughness: 0,
    strokeWidth: 1.5,
    groupIds: [group],
    frameId,
  };
  const line = (
    points: [number, number][],
    color = common.strokeColor,
  ): ExcalidrawElementSkeleton => {
    points = points.map((p) => [p[0] * unit, p[1] * unit]);
    return {
      type: "line",
      x: x + points[0][0],
      y: y + points[0][1],
      width:
        Math.max(...points.map((p) => p[0])) -
        Math.min(...points.map((p) => p[0])),
      height:
        Math.max(...points.map((p) => p[1])) -
        Math.min(...points.map((p) => p[1])),
      points: points.map((p) => [p[0] - points[0][0], p[1] - points[0][1]]),
      ...common,
      strokeColor: color,
    } as unknown as ExcalidrawElementSkeleton;
  };
  const text = (
    dx: number,
    dy: number,
    t: string,
  ): ExcalidrawElementSkeleton => ({
    type: "text",
    x: x + dx * unit,
    y: y + dy * unit,
    text: t,
    fontSize: 14,
    ...common,
  });
  if (tool === "ruler") {
    const out = [
      line([
        [0, 0],
        [600, 0],
      ]),
    ];
    for (let n = 0; n <= 20; n++) {
      out.push(
        line([
          [n * 30, 0],
          [n * 30, n % 5 === 0 ? 22 : 12],
        ]),
        text(n * 30 - 4, 26, String(n)),
      );
    }
    return out;
  }
  if (tool === "protractor") {
    const out = [
      line([
        [0, 0],
        [360, 0],
      ]),
    ];
    for (let n = 0; n <= 180; n += 10) {
      const a = (n * Math.PI) / 180;
      out.push(
        line([
          [180 + 180 * Math.cos(a), -180 * Math.sin(a)],
          [180 + 165 * Math.cos(a), -165 * Math.sin(a)],
        ]),
        text(180 + 145 * Math.cos(a) - 10, -145 * Math.sin(a) - 8, String(n)),
      );
    }
    out.push(
      line(
        Array.from(
          { length: 61 },
          (_, n) =>
            [
              180 + 180 * Math.cos((n * Math.PI) / 60),
              -180 * Math.sin((n * Math.PI) / 60),
            ] as [number, number],
        ),
      ),
      line([
        [173, 0],
        [187, 0],
      ]),
      line([
        [180, -7],
        [180, 7],
      ]),
    );
    return out;
  }
  if (tool === "angle") {
    const a = (value * Math.PI) / 180;
    return [
      line([
        [240, 0],
        [0, 0],
        [240 * Math.cos(a), -240 * Math.sin(a)],
      ]),
      line(
        Array.from(
          { length: 31 },
          (_, n) =>
            [55 * Math.cos((a * n) / 30), -55 * Math.sin((a * n) / 30)] as [
              number,
              number,
            ],
        ),
        "#f2905e",
      ),
      text(70 * Math.cos(a / 2), -70 * Math.sin(a / 2) - 10, `${value}°`),
    ];
  }
  if (tool === "perpendicular") {
    return [
      line([
        [-150, 0],
        [150, 0],
      ]),
      line([
        [0, -150],
        [0, 150],
      ]),
      line(
        [
          [20, 0],
          [20, -20],
          [0, -20],
        ],
        "#f2905e",
      ),
    ];
  }
  if (tool === "circle") {
    const r = value * 30;
    return [
      {
        type: "ellipse",
        x,
        y,
        width: r * 2 * unit,
        height: r * 2 * unit,
        ...common,
      },
      line([
        [r, r],
        [r * 2, r],
      ]),
      text(r + 8, r + 8, "O"),
      text(r * 1.4, r - 25, `R = ${value}`),
    ];
  }
  if (tool === "triangle") {
    const a = value * 30;
    const b = a * 0.75;
    return [
      line([
        [0, 0],
        [a, 0],
        [0, -b],
        [0, 0],
      ]),
      line(
        [
          [20, 0],
          [20, -20],
          [0, -20],
        ],
        "#f2905e",
      ),
      text(-20, 8, "A"),
      text(a + 6, 0, "B"),
      text(-20, -b - 20, "C"),
    ];
  }
  return [
    line([
      [0, 0],
      [180, 0],
    ]),
    line(
      [
        [85, -10],
        [95, 10],
      ],
      "#f2905e",
    ),
  ];
};
