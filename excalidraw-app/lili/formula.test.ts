import { formulaSVG } from "./formula";

describe("formula images", () => {
  it.each([
    String.raw`\frac{3}{8}`,
    String.raw`\sqrt{x^2+1}`,
    String.raw`\begin{cases}x+y=5\\x-y=1\end{cases}`,
  ])("renders self-contained SVG for %s", (tex) => {
    const svg = formulaSVG(tex);
    expect(svg).toContain("<svg");
    expect(svg).toContain("<path");
    expect(svg).not.toContain("currentColor");
    expect(svg).not.toContain("foreignObject");
    expect(svg).not.toContain("<script");
    expect(
      new DOMParser()
        .parseFromString(svg, "image/svg+xml")
        .querySelector("parsererror"),
    ).toBeNull();
  });
  it("reports malformed and empty formulas", () => {
    expect(() => formulaSVG("")).toThrow();
    expect(() => formulaSVG(String.raw`\frac{1}{`)).toThrow();
  });
});
