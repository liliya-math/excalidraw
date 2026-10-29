// A deliberately small mathematical grammar. No JavaScript evaluation.
export const compileGraph = (source: string): ((x: number) => number) => {
  const input = source
    .trim()
    .replace(/^y\s*=/i, "")
    .replace(/,/g, ".")
    .replace(/π/g, "pi")
    .replace(/[−–]/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/");
  if (!input || input.length > 300) {
    throw new Error("Введите функцию длиной до 300 символов.");
  }
  const tokens =
    input.match(/(?:\d+(?:\.\d*)?|\.\d+)|[a-z]+|[()+\-*/^]/gi) || [];
  if (tokens.join("") !== input.replace(/\s/g, "")) {
    throw new Error("Используйте x, числа, скобки и математические операции.");
  }
  let i = 0;
  type Fn = (x: number) => number;
  const functions: Record<string, (n: number) => number> = {
    sqrt: Math.sqrt,
    abs: Math.abs,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    ln: Math.log,
    log: Math.log10,
    exp: Math.exp,
  };
  const atom = (): Fn => {
    const t = tokens[i++];
    if (t === "(") {
      const f = sum();
      if (tokens[i++] !== ")") {
        throw new Error("Проверьте скобки.");
      }
      return f;
    }
    if (t === "x") {
      return (x) => x;
    }
    if (t === "pi") {
      return () => Math.PI;
    }
    if (t === "e") {
      return () => Math.E;
    }
    if (t && /^\d|^\./.test(t)) {
      return () => Number(t);
    }
    if (t && Object.hasOwn(functions, t)) {
      if (tokens[i++] !== "(") {
        throw new Error("После функции нужны скобки: sqrt(x).");
      }
      const f = sum();
      if (tokens[i++] !== ")") {
        throw new Error("Проверьте скобки.");
      }
      return (x) => functions[t](f(x));
    }
    throw new Error("Неизвестная запись. Например: x^2, 2x+1, sqrt(x).");
  };
  const power = (): Fn => {
    const left = atom();
    if (tokens[i] === "^") {
      i++;
      const right = unary();
      return (x) => left(x) ** right(x);
    }
    return left;
  };
  const unary = (): Fn => {
    if (tokens[i] === "+" || tokens[i] === "-") {
      const sign = tokens[i++];
      const f = unary();
      return (x) => (sign === "-" ? -1 : 1) * f(x);
    }
    return power();
  };
  const product = (): Fn => {
    let f = unary();
    while (i < tokens.length) {
      const t = tokens[i];
      const implicit = t === "(" || /^[a-z]|^\d|^\./i.test(t);
      if (t !== "*" && t !== "/" && !implicit) {
        break;
      }
      if (!implicit) {
        i++;
      }
      const a = f;
      const b = unary();
      f = t === "/" ? (x) => a(x) / b(x) : (x) => a(x) * b(x);
    }
    return f;
  };
  const sum = (): Fn => {
    let f = product();
    while (tokens[i] === "+" || tokens[i] === "-") {
      const t = tokens[i++];
      const a = f;
      const b = product();
      f = t === "+" ? (x) => a(x) + b(x) : (x) => a(x) - b(x);
    }
    return f;
  };
  const result = sum();
  if (i !== tokens.length) {
    throw new Error("Проверьте запись функции и скобки.");
  }
  return result;
};

export const graphSVG = (source: string, min: number, max: number) => {
  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    min >= max ||
    max - min < 0.01 ||
    Math.max(Math.abs(min), Math.abs(max)) > 10000
  ) {
    throw new Error(
      "Укажите границы от -10000 до 10000, минимум меньше максимума (интервал от 0,01).",
    );
  }
  const f = compileGraph(source);
  const size = 600;
  const margin = 40;
  const span = max - min;
  const px = (x: number) => margin + ((x - min) / span) * 520;
  const py = (y: number) => size - px(y);
  const step = 10 ** Math.floor(Math.log10(span / 10));
  const gridStep = span / step > 20 ? step * 5 : step;
  const lines: string[] = [];
  for (let n = Math.ceil(min / gridStep) * gridStep; n <= max; n += gridStep) {
    const label = Number(n.toPrecision(6));
    lines.push(
      `<path d="M${px(n)} 40V560 M40 ${py(
        n,
      )}H560" stroke="#dce4e0"/><text x="${px(
        n,
      )}" y="580" text-anchor="middle">${label}</text><text x="34" y="${
        py(n) + 4
      }" text-anchor="end">${label}</text>`,
    );
  }
  const paths: string[] = [];
  let drawing = false;
  let previous = NaN;
  let count = 0;
  for (let j = 0; j <= 1800; j++) {
    const x = min + (span * j) / 1800;
    const y = f(x);
    const p = py(y);
    if (!Number.isFinite(y) || y < min || y > max) {
      drawing = false;
      previous = NaN;
      continue;
    }
    const jump = Math.abs(p - previous) > 120;
    paths.push(
      `${drawing && !jump ? "L" : "M"}${px(x).toFixed(2)} ${p.toFixed(2)}`,
    );
    drawing = true;
    previous = p;
    count++;
  }
  if (!count) {
    throw new Error("В указанном диапазоне график не виден. Измените границы.");
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" rx="12" fill="#fffdf7"/><text x="300" y="24" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="#172b23">y = ${source
    .replace(/^y\s*=/i, "")
    .slice(
      0,
      100,
    )}</text><g font-family="Arial,sans-serif" font-size="11" fill="#42594f">${lines.join(
    "",
  )}</g>${
    min <= 0 && max >= 0
      ? `<path d="M${px(0)} 40V560 M40 ${py(
          0,
        )}H560" stroke="#42594f" stroke-width="2"/>`
      : ""
  }<path d="${paths.join(
    " ",
  )}" fill="none" stroke="#345cf4" stroke-width="3"/></svg>`;
};
