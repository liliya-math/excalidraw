import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import "mathjax-full/js/input/tex/ams/AmsConfiguration.js";

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const engine = mathjax.document("", {
  InputJax: new TeX({ packages: ["base", "ams"], maxBuffer: 3000 }),
  OutputJax: new SVG({ fontCache: "none" }),
});
export const formulaSVG = (tex: string) => {
  if (!tex.trim() || tex.length > 2000) {
    throw new Error("Введите формулу длиной до 2000 символов.");
  }
  const node = engine.convert(tex, { display: true });
  const result = adaptor.innerHTML(node);
  if (
    result.includes("data-mjx-error") ||
    result.includes('data-mml-node="merror"')
  ) {
    throw new Error("Проверьте формулу и скобки.");
  }
  // Self-contained vector paths; no external fonts, HTML or remote resources.
  return result.replace(/currentColor/g, "#172b23");
};
