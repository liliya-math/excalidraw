import { get, set, createStore } from "idb-keyval";
import { newElementWith } from "@excalidraw/element";
import {
  encryptData,
  decryptData,
} from "@excalidraw/excalidraw/data/encryption";
import { restoreElements } from "@excalidraw/excalidraw";

import type {
  ExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

export const readRoom = (hash: string) => {
  const match =
    /^#room=([\w-]+),([\w-]{22})(?:;(teacher|student)=([\w-]{32,128}))?$/.exec(
      hash,
    );
  return match
    ? { id: match[1], key: match[2], role: match[3], token: match[4] }
    : null;
};
export const storageBase = `${String(
  import.meta.env.VITE_APP_WS_SERVER_URL || "",
).replace(/\/$/, "")}/storage`;
type Credentials = { teacher?: string; student?: string };
type Sealed = { iv: string; ciphertext: string };
export type WorkspaceInfo = {
  exists: boolean;
  role?: "teacher" | "student" | "visitor";
  protected?: Sealed | null;
  revision?: number;
  teacherSocketId?: string;
};
let session: {
  id: string;
  credentials: Credentials;
  win: Window & typeof globalThis;
} | null = null;
let protectedElements: readonly ExcalidrawElement[] = [];
let revision = 0;
let database: ReturnType<typeof createStore> | null = null;
const stores = () =>
  database || (database = createStore("lili-lesson-workspace", "data"));
const credentialKey = (id: string) => `lili-workspace-access-${id}`;
export const initWorkspace = (win: Window & typeof globalThis) => {
  const room = readRoom(win.location.hash);
  protectedElements = [];
  revision = 0;
  if (!room) {
    session = null;
    return null;
  }
  let credentials: Credentials = {};
  try {
    credentials = JSON.parse(
      win.localStorage.getItem(credentialKey(room.id)) || "{}",
    );
  } catch {
    /* new device */
  }
  if (room.role && room.token) {
    credentials[room.role as keyof Credentials] = room.token;
  }
  session = { id: room.id, credentials, win };
  return room;
};
export const workspaceHeaders = (roomId?: string): Record<string, string> => {
  if (!session || (roomId && session.id !== roomId)) {
    return {};
  }
  const token = session.credentials.teacher || session.credentials.student;
  return token ? { Authorization: `Bearer ${token}` } : {};
};
export const decorateInvite = (id: string, link: string) =>
  session?.id === id && session.credentials.student
    ? `${link};student=${session.credentials.student}`
    : link;
export const workspaceRole = () =>
  session?.credentials.teacher
    ? "teacher"
    : session?.credentials.student
    ? "student"
    : "visitor";
const bytes64 = (bytes: Uint8Array, win: Window & typeof globalThis) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return win.btoa(binary);
};
const un64 = (value: string, win: Window & typeof globalThis) =>
  Uint8Array.from(win.atob(value), (c) => c.charCodeAt(0));
const seal = async (
  elements: readonly ExcalidrawElement[],
  key: string,
  win: Window & typeof globalThis,
): Promise<Sealed> => {
  const result = await encryptData(
    key,
    new TextEncoder().encode(JSON.stringify(elements)),
  );
  return {
    iv: bytes64(result.iv, win),
    ciphertext: bytes64(new Uint8Array(result.encryptedBuffer), win),
  };
};
const deriveStudent = async (
  teacher: string,
  win: Window & typeof globalThis,
) => {
  const digest = await win.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`student:${teacher}`),
  );
  return Array.from(new Uint8Array(digest), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
};
export const fetchWorkspace = async (
  room: { id: string; key: string },
  win: Window & typeof globalThis,
) => {
  const response = await win.fetch(`${storageBase}/workspaces/${room.id}`, {
    headers: workspaceHeaders(room.id),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      "Для защиты доски требуется обновление сервера. Остальные инструменты доступны.",
    );
  }
  const data = (await response.json()) as WorkspaceInfo;
  if (
    data.role === "teacher" &&
    session?.id === room.id &&
    session.credentials.teacher &&
    !session.credentials.student
  ) {
    session.credentials.student = await deriveStudent(
      session.credentials.teacher,
      win,
    );
    win.localStorage.setItem(
      credentialKey(room.id),
      JSON.stringify(session.credentials),
    );
  }
  if (data.protected) {
    const decoded = await decryptData(
      un64(data.protected.iv, win),
      un64(data.protected.ciphertext, win),
      room.key,
    );
    protectedElements = restoreElements(
      JSON.parse(new TextDecoder().decode(decoded)),
      null,
    );
  } else {
    protectedElements = [];
  }
  revision = data.revision || 0;
  return data;
};
export const claimWorkspace = async (
  room: { id: string; key: string },
  win: Window & typeof globalThis,
) => {
  const token = () =>
    Array.from(win.crypto.getRandomValues(new Uint8Array(32)), (v) =>
      v.toString(16).padStart(2, "0"),
    ).join("");
  const previous = win.localStorage.getItem(credentialKey(room.id));
  if (session?.id === room.id && session.credentials.teacher) {
    const existing = await fetchWorkspace(room, win);
    if (existing.role === "teacher") {
      return existing;
    }
  }
  const teacher = token();
  const credentials = { teacher, student: await deriveStudent(teacher, win) };
  // Keep the recovery credential before the request: retries cannot lose ownership.
  win.localStorage.setItem(credentialKey(room.id), JSON.stringify(credentials));
  session = { id: room.id, credentials, win };
  const response = await win.fetch(`${storageBase}/workspaces/${room.id}`, {
    method: "POST",
    headers: { ...workspaceHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ studentToken: credentials.student }),
  });
  if (!response.ok) {
    if (response.status === 409) {
      if (previous) {
        win.localStorage.setItem(credentialKey(room.id), previous);
      } else {
        win.localStorage.removeItem(credentialKey(room.id));
      }
      session = {
        id: room.id,
        win,
        credentials: previous ? JSON.parse(previous) : {},
      };
    }
    throw new Error(
      response.status === 409
        ? "Доска уже защищена. Открой ссылку учителя на устройстве, где включали защиту."
        : "Не удалось включить защиту: требуется обновление сервера.",
    );
  }
  return fetchWorkspace(room, win);
};
export const saveProtection = async (
  room: { id: string; key: string },
  elements: readonly ExcalidrawElement[],
  win: Window & typeof globalThis,
  teacherSocketId?: string,
) => {
  const response = await win.fetch(`${storageBase}/workspaces/${room.id}`, {
    method: "PUT",
    headers: { ...workspaceHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      revision,
      protected: await seal(elements, room.key, win),
      teacherSocketId,
    }),
  });
  if (response.status === 409) {
    throw new Error(
      "Защита изменена в другом окне. Обнови список и повтори действие.",
    );
  }
  if (!response.ok) {
    throw new Error("Защиту может менять только учитель по своей ссылке.");
  }
  const result = await response.json();
  revision = result.revision;
  protectedElements = elements;
};
export const protectedIds = () => new Set(protectedElements.map((e) => e.id));
const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stable);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !["version", "versionNonce", "updated", "index", "status"].includes(
              key,
            ),
        )
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, stable(entry)]),
    );
  }
  return value;
};
export const enforceProtection = <T extends ExcalidrawElement>(
  elements: readonly T[],
): readonly T[] => {
  if (!protectedElements.length) {
    return elements;
  }
  const map = new Map(elements.map((e) => [e.id, e]));
  let changed = false;
  for (const canonical of protectedElements) {
    const current = map.get(canonical.id);
    if (
      !current ||
      JSON.stringify(stable(current)) !== JSON.stringify(stable(canonical))
    ) {
      changed = true;
      const base = {
        ...canonical,
        version: Math.max(canonical.version, current?.version || 0),
      };
      const restored = newElementWith(
        base,
        { locked: true, isDeleted: false },
        true,
      );
      map.set(canonical.id, restored as T);
    }
  }
  return changed ? [...map.values()] : elements;
};
export const recoveryLink = (win: Window & typeof globalThis) => {
  const room = readRoom(win.location.hash);
  return room && session?.credentials.teacher
    ? `${win.location.origin}${win.location.pathname}#room=${room.id},${room.key};teacher=${session.credentials.teacher}`
    : null;
};

export type Snapshot = {
  id: string;
  name: string;
  created: number;
  elements: readonly ExcalidrawElement[];
  files: BinaryFiles;
};
export const workspaceKey = (win: Window & typeof globalThis) =>
  readRoom(win.location.hash)?.id || "local";
export const snapshots = async (key: string): Promise<Snapshot[]> =>
  (await get(`history-${key}`, stores())) || [];
export const takeSnapshot = async (
  key: string,
  api: ExcalidrawImperativeAPI,
  name: string,
) => {
  const elements = api.getSceneElementsIncludingDeleted();
  const ids = new Set(
    elements
      .filter((e) => e.type === "image")
      .map((e) => (e.type === "image" ? e.fileId : null)),
  );
  const files = Object.fromEntries(
    Object.entries(api.getFiles()).filter(([id]) => ids.has(id as never)),
  );
  const snapshot: Snapshot = JSON.parse(
    JSON.stringify({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      created: Date.now(),
      elements,
      files,
    }),
  );
  if (JSON.stringify(snapshot).length > 40 * 1024 * 1024) {
    throw new Error(
      "Доска слишком большая для снимка. Сохрани её через меню в файл.",
    );
  }
  const next = [snapshot, ...(await snapshots(key))].slice(0, 12);
  while (JSON.stringify(next).length > 100 * 1024 * 1024 && next.length > 1) {
    next.pop();
  }
  await set(`history-${key}`, next, stores());
  return snapshot;
};
export type PrivateStep = {
  id: string;
  title: string;
  text: string;
  lessonId: string;
};
export type PrivatePlan = { notes: string; steps: PrivateStep[] };
export const loadPlan = async (key: string): Promise<PrivatePlan> =>
  (await get(`plan-${key}`, stores())) || { notes: "", steps: [] };
export const savePlan = (key: string, value: PrivatePlan) =>
  set(`plan-${key}`, value, stores());
export const restoreSnapshot = (
  snapshot: Snapshot,
  api: ExcalidrawImperativeAPI,
) => {
  api.addFiles(Object.values(snapshot.files));
  const existing = api.getSceneElementsIncludingDeleted();
  const old = new Map(existing.map((e) => [e.id, e]));
  const incoming = new Set(snapshot.elements.map((e) => e.id));
  const restored = restoreElements(snapshot.elements, null).map((e) =>
    newElementWith(
      { ...e, version: Math.max(e.version, old.get(e.id)?.version || 0) },
      {},
      true,
    ),
  );
  const removed = existing
    .filter((e) => !incoming.has(e.id))
    .map((e) => newElementWith(e, { isDeleted: true }));
  return [...restored, ...removed] as OrderedExcalidrawElement[];
};
