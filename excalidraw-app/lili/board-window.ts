const BOARD_ORIGIN = "https://liliya-math.github.io";
const CABINET_ORIGIN = "https://lilimath.ru";
export const boardIdentity = (raw: string) => {
  try {
    const url = new URL(raw);
    if (
      url.origin !== BOARD_ORIGIN ||
      url.pathname !== "/excalidraw/" ||
      url.username ||
      url.password
    ) {
      return null;
    }
    const match =
      /^#room=([\w-]+),([\w-]{22})(?:;(teacher|student)=([\w-]{32,128}))?$/.exec(
        url.hash,
      );
    return match
      ? {
          url,
          id: match[1],
          key: match[2],
          role: match[3] || "shared",
          token: match[4] || "",
        }
      : null;
  } catch {
    return null;
  }
};
export const boardTargetName = (raw: string) => {
  const parsed = boardIdentity(raw);
  if (!parsed) {
    return "";
  }
  let hash = 2166136261;
  for (const char of `${parsed.key}|${parsed.token}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return `lili-board-${parsed.id}-${parsed.role}-${(hash >>> 0).toString(36)}`;
};
export const sameBoardAccess = (first: string, second: string) => {
  const a = boardIdentity(first);
  const b = boardIdentity(second);
  return (
    !!a &&
    !!b &&
    a.id === b.id &&
    a.key === b.key &&
    a.role === b.role &&
    a.token === b.token
  );
};
export const mergeBoardRequest = (current: string, incoming: string) => {
  if (!sameBoardAccess(current, incoming)) {
    throw new Error("Другая комната или ссылка доступа.");
  }
  const before = new URL(current);
  const next = new URL(incoming);
  if (
    !next.searchParams.get("cabinet") ||
    !before.searchParams.get("cabinet") ||
    next.searchParams.get("cabinet") === before.searchParams.get("cabinet")
  ) {
    for (const key of [
      "cabinet",
      "cabinetRole",
      "studentName",
      "lessonId",
      "lessonDate",
      "lessonTitle",
      "video",
      "startLesson",
    ]) {
      if (!next.searchParams.has(key) && before.searchParams.has(key)) {
        next.searchParams.set(key, before.searchParams.get(key)!);
      }
    }
  }
  return next.href;
};
export const boardAccessHash = async (crypto: Crypto, hash: string) => {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(hash),
  );
  return Array.from(new Uint8Array(bytes), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
};
export const registerBoardWindow = (
  doc: Document,
  onOpen: (url: string) => void,
) => {
  const win = doc.defaultView!;
  const name = boardTargetName(win.location.href);
  if (name) {
    win.name = name;
  }
  const receive = async (event: MessageEvent) => {
    if (
      event.origin !== CABINET_ORIGIN ||
      !event.source ||
      event.data?.type !== "lili-board-open" ||
      typeof event.data.requestId !== "string" ||
      event.data.requestId.length > 100 ||
      typeof event.data.url !== "string" ||
      event.data.url.length > 20000 ||
      typeof event.data.access !== "string" ||
      !/^[a-f0-9]{64}$/.test(event.data.access)
    ) {
      return;
    }
    let accepted = false;
    let incoming = "";
    try {
      const url = new URL(event.data.url);
      const hash = win.location.hash;
      if (
        !url.hash &&
        (await boardAccessHash(win.crypto, hash)) === event.data.access &&
        win.location.hash === hash
      ) {
        url.hash = hash;
        incoming = url.href;
        accepted = sameBoardAccess(win.location.href, incoming);
      }
    } catch {
      /* Ignore malformed URLs or unavailable cryptography. */
    }

    (event.source as Window).postMessage(
      { type: "lili-board-opened", requestId: event.data.requestId, accepted },
      CABINET_ORIGIN,
    );
    if (accepted) {
      onOpen(incoming);
    }
  };
  win.addEventListener("message", receive);
  return () => win.removeEventListener("message", receive);
};
