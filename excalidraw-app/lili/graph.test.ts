import { compileGraph, graphSVG } from "./graph";

describe("school graph expressions", () => {
  it.each([
    ["2x+1", 3, 7],
    ["-x^2", 3, -9],
    ["(-x)^2", 3, 9],
    ["2^3^2", 0, 512],
    ["x^-2", 2, 0.25],
    ["y = sqrt(x)", 9, 3],
    ["2(x+1)", 3, 8],
    ["(x+1)(x-1)", 3, 8],
    ["abs(x)", -3, 3],
    ["sin(pi/2)", 0, 1],
    ["1,5x", 2, 3],
  ])("evaluates %s", (source, x, expected) => {
    expect(compileGraph(source as string)(x as number)).toBeCloseTo(
      expected as number,
    );
  });
  it.each(["x;alert(1)", "constructor(x)", "x=2", "sqrt(x", "x+", ""])(
    "rejects unsupported syntax %s",
    (source) => {
      expect(() => compileGraph(source)).toThrow();
    },
  );
  it("breaks reciprocal curves at asymptotes", () => {
    const svg = graphSVG("1/x", -10, 10);
    const path = svg.match(/<path d="([^"]+)" fill="none"/)![1];
    expect(path.match(/M/g)?.length).toBeGreaterThanOrEqual(2);
    expect(svg).not.toContain("NaN");
    expect(svg).not.toContain("Infinity");
  });
  it("rejects invalid bounds and invisible functions", () => {
    expect(() => graphSVG("x", 1, 1)).toThrow();
    expect(() => graphSVG("x", NaN, 10)).toThrow();
    expect(() => graphSVG("100", -10, 10)).toThrow();
  });
});
