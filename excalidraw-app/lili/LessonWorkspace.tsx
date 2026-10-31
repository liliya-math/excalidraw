import React, { useEffect, useRef, useState, useCallback } from "react";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { newElementWith } from "@excalidraw/element";
import { randomId } from "@excalidraw/common";

import type {
  ExcalidrawImperativeAPI,
  SocketId,
  UserToFollow,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  createLesson,
  lessonFrames,
  lessonPlacement,
  addLessonElements,
  setActiveLesson,
} from "./lesson-model";
import {
  initWorkspace,
  prepareClientTeacher,
  claimClientWorkspace,
  workspaceKey,
  fetchWorkspace,
  claimWorkspace,
  saveProtection,
  protectedIds,
  enforceProtection,
  decorateInvite,
  recoveryLink,
  snapshots,
  takeSnapshot,
  restoreSnapshot,
  loadPlan,
  savePlan,
} from "./workspace";
import {
  clientIsStudent,
  clientPinnedIds,
  pinElements,
  unpinElements,
} from "./client-protection";

import { exportLessonPDF, download } from "./lesson-export";
import {
  addMaterial,
  trustedMaterialURL,
  findMaterial,
  materialKey,
} from "./materials";
import {
  registerBoardWindow,
  sameBoardAccess,
  mergeBoardRequest,
} from "./board-window";
import { MaterialDuplicateDialog } from "./MaterialDuplicateDialog";
import { LessonTemplates } from "./LessonTemplates";
import { ContentTemplates } from "./ContentTemplates";

import { geometryElements } from "./geometry-tools";

import { VideoCall } from "./VideoCall";
import { cabinetContext } from "./cabinet-context";
import { ensureLessonSession } from "./lesson-session";
import { saveStatusText } from "./save-status";

import "./LessonWorkspace.scss";

import type { BoardSaveStatus } from "./save-status";

import type { GeometryTool } from "./geometry-tools";
import type { Material } from "./materials";
import type { WorkspaceInfo, Snapshot, PrivatePlan } from "./workspace";
import type { CollabAPI } from "../collab/Collab";

type Panel =
  | "content"
  | "templates"
  | "lessons"
  | "plan"
  | "history"
  | "pdf"
  | "materials"
  | "geometry"
  | "access";
export const LessonWorkspace = ({
  api,
  collab,
  following,
  onSimpleMode,
  onAccess,
}: {
  api: ExcalidrawImperativeAPI;
  collab: CollabAPI | null;
  following: UserToFollow | null;
  onSimpleMode: (value: boolean) => void;
  onAccess: (value: "teacher" | "student" | "visitor" | null) => void;
}) => {
  const root = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<Document | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [elements, setElements] = useState<readonly ExcalidrawElement[]>(
    api.getSceneElements(),
  );
  const [simple, setSimple] = useState(false);
  const [video, setVideo] = useState(false);
  const [saveStatus, setSaveStatus] = useState<BoardSaveStatus>({
    state: "connecting",
  });
  const [savingNow, setSavingNow] = useState(false);
  const [contentRequested, setContentRequested] = useState("");
  const [requestTick, setRequestTick] = useState(0);
  const [pendingMaterials, setPendingMaterials] = useState<
    { url: string; title: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const busyCount = useRef(0);
  const boardRequests = useRef(Promise.resolve());
  const handleBoardOpen = useRef<(url: string) => Promise<void>>(
    async () => {},
  );
  const [message, setMessage] = useState("");
  const [room, setRoom] = useState<ReturnType<typeof initWorkspace>>(null);
  const [info, setInfo] = useState<WorkspaceInfo | null>(null);
  const [serverError, setServerError] = useState("");
  const [clientReady, setClientReady] = useState(false);
  const [name, setName] = useState("");
  const [active, setActive] = useState("");
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [plan, setPlan] = useState<PrivatePlan>({ notes: "", steps: [] });
  const [planReady, setPlanReady] = useState(false);
  const [stepTitle, setStepTitle] = useState("");
  const [stepText, setStepText] = useState("");
  const [catalog, setCatalog] = useState<Material[]>([]);
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("");
  const [pdfFrames, setPdfFrames] = useState<string[]>([]);
  const [squared, setSquared] = useState(false);
  const [geometry, setGeometry] = useState<GeometryTool>("angle");
  const [size, setSize] = useState("60");
  const [followId, setFollowId] = useState("");
  const roomHash = doc?.defaultView?.location.hash || "";
  const generation = useRef(0);
  const changed = useRef(0);
  const saved = useRef(-1);
  const lastAuto = useRef(0);
  const autoBusy = useRef(false);
  const live = useRef(true);
  const key = doc ? workspaceKey(doc.defaultView!) : "local";
  const frames = lessonFrames(elements);
  const clientStudent = clientReady && clientIsStudent();
  const isStudent = info?.exists
    ? info.role !== "teacher"
    : simple || clientStudent;
  const canTeach = !isStudent;
  const context = doc ? cabinetContext(doc.defaultView!.location.search) : null;
  const requestMaterial = useCallback(
    async (url: string, title: string) => {
      if (!doc) {
        return "Доска ещё открывается.";
      }
      if (api.getAppState().isLoading) {
        return "Доска ещё загружается. Повтори добавление после открытия комнаты.";
      }
      if (findMaterial(api, url).length) {
        setPendingMaterials((current) =>
          current.some((m) => materialKey(m.url) === materialKey(url))
            ? current
            : [...current, { url, title }],
        );
        return "Материал уже есть. Выбери переход или добавление копии.";
      }
      return addMaterial(api, doc, url, title, setMessage);
    },
    [doc, api],
  );
  useEffect(() => {
    if (!doc || !clientReady || !canTeach) {
      return;
    }
    const requested = new URLSearchParams(doc.defaultView!.location.search).get(
      "contentTemplate",
    );
    if (requested && /^[a-z0-9_-]{1,100}$/i.test(requested)) {
      setContentRequested(requested);
      setPanel("content");
    }
  }, [doc, clientReady, canTeach, requestTick, roomHash]);
  handleBoardOpen.current = async (incoming) => {
    if (!doc) {
      return;
    }
    const win = doc.defaultView!;
    if (!sameBoardAccess(win.location.href, incoming)) {
      return;
    }
    incoming = mergeBoardRequest(win.location.href, incoming);
    win.history.replaceState(null, "", incoming);
    setRequestTick((value) => value + 1);
    const params = new URL(incoming).searchParams;
    if (params.get("video") === "1") {
      setVideo(true);
    }
    const material = params.get("material");
    if (!material) {
      return;
    }
    const hash = win.location.hash;
    for (
      let i = 0;
      api.getAppState().isLoading ||
      (params.get("startLesson") === "1" &&
        new URLSearchParams(win.location.search).get("startLesson") === "1");
      i++
    ) {
      if (i > 120 || hash !== win.location.hash) {
        throw new Error("Доска ещё загружается. Повтори добавление материала.");
      }
      await new Promise<void>((resolve) => win.setTimeout(resolve, 250));
    }
    if (hash !== win.location.hash) {
      return;
    }
    busyCount.current++;
    setBusy(true);
    try {
      setMessage(
        await requestMaterial(
          material,
          params.get("materialTitle") || "Материал из кабинета",
        ),
      );
      const current = new URLSearchParams(win.location.search);
      if (current.get("material") === material) {
        current.delete("material");
        current.delete("materialTitle");
      }
      win.history.replaceState(
        null,
        "",
        win.location.pathname +
          (current.size ? `?${current}` : "") +
          win.location.hash,
      );
    } finally {
      busyCount.current--;
      setBusy(busyCount.current > 0);
    }
  };
  useEffect(() => {
    if (!doc) {
      return;
    }
    return registerBoardWindow(doc, (url) => {
      boardRequests.current = boardRequests.current
        .catch(() => {})
        .then(() => handleBoardOpen.current(url))
        .catch((error) => setMessage((error as Error).message));
    });
  }, [doc, roomHash]);

  useEffect(() => {
    if (!doc) {
      return;
    }
    const win = doc.defaultView!;
    const refreshStatus = () => {
      const next = collab?.getSaveStatus?.() || {
        state: room ? ("connecting" as const) : ("local" as const),
      };
      setSaveStatus((previous) =>
        previous.state === next.state && previous.savedAt === next.savedAt
          ? previous
          : next,
      );
    };
    refreshStatus();
    const timer = win.setInterval(refreshStatus, 1500);
    return () => win.clearInterval(timer);
  }, [doc, collab, room]);

  useEffect(() => {
    if (!doc || !clientReady || !canTeach) {
      return;
    }
    const win = doc.defaultView!;
    const selected = cabinetContext(win.location.search);
    if (!selected?.start || !selected.lessonId) {
      return;
    }
    let cancelled = false;
    let timer: number;
    const enter = () => {
      if (cancelled) {
        return;
      }
      if (api.getAppState().isLoading) {
        timer = win.setTimeout(enter, 300);
        return;
      }
      const frame = ensureLessonSession(api, selected);
      setActiveLesson(frame.id);
      setActive(frame.id);
      api.setViewport({ target: frame, fit: "scale-down", animation: true });
      const params = new URLSearchParams(win.location.search);
      params.delete("startLesson");
      win.history.replaceState(
        null,
        "",
        win.location.pathname +
          (params.size ? `?${params}` : "") +
          win.location.hash,
      );
      setMessage(
        "Открыта область этого занятия. План и итоги доступны в карточке кабинета.",
      );
    };
    timer = win.setTimeout(enter, 400);
    return () => {
      cancelled = true;
      win.clearTimeout(timer);
    };
  }, [doc, api, clientReady, canTeach, roomHash, requestTick]);
  const finishLesson = async () => {
    if (!doc || !context?.teacher || !context.lessonId || savingNow) {
      return;
    }
    setSavingNow(true);
    try {
      await takeSnapshot(key, api, "Перед завершением урока");
      setHistory(await snapshots(key));
      if (collab?.isCollaborating()) {
        await collab.saveNow?.();
      }
      const status = collab?.getSaveStatus?.() || { state: "local" as const };
      setSaveStatus(status);
      if (room && status.state !== "saved") {
        setMessage(
          "Локальный снимок сделан. Дождись сохранения на сервере и нажми «Завершить урок» ещё раз.",
        );
        return;
      }
      doc.defaultView!.location.assign(context.finishBack);
    } catch (error) {
      setMessage(
        `Не удалось подготовить завершение: ${
          (error as Error).message
        }. Сохрани доску через меню.`,
      );
    } finally {
      setSavingNow(false);
    }
  };
  const saveNow = async () => {
    if (!doc || savingNow) {
      return;
    }
    setSavingNow(true);
    try {
      await takeSnapshot(key, api, "Ручной снимок");
      setHistory(await snapshots(key));
      if (collab?.isCollaborating()) {
        await collab.saveNow?.();
      }
      setSaveStatus(collab?.getSaveStatus?.() || { state: "local" });
      setMessage(
        "Локальный снимок сохранён. Статус сервера показан рядом с кнопкой.",
      );
    } catch (e) {
      setMessage(
        `Сохранение не завершено: ${
          (e as Error).message
        }. Можно выгрузить доску через меню.`,
      );
    } finally {
      setSavingNow(false);
    }
  };

  useEffect(() => {
    const owner = root.current?.ownerDocument;
    if (owner) {
      setDoc(owner);
    }
    return () => {
      live.current = false;
      setActiveLesson("");
    };
  }, []);
  useEffect(() => {
    if (!doc) {
      return;
    }
    const win = doc.defaultView!;
    live.current = true;
    const ownGeneration = ++generation.current;
    const current = initWorkspace(win);
    setClientReady(false);
    void prepareClientTeacher()
      .catch(() => {
        if (live.current && generation.current === ownGeneration) {
          setMessage("Не удалось восстановить ссылку учителя в этом браузере.");
        }
      })
      .finally(() => {
        if (live.current && generation.current === ownGeneration) {
          setClientReady(true);
        }
      });
    setPendingMaterials([]);
    setRoom(current);
    setInfo(null);
    onAccess(null);
    setActive("");
    setActiveLesson("");
    setPlanReady(false);
    const storageKey = workspaceKey(win);
    let selectedSimple = false;
    try {
      selectedSimple =
        win.localStorage.getItem(`lili-simple-${storageKey}`) === "1";
    } catch {}
    if (current?.role === "student") {
      selectedSimple = true;
    }
    setSimple(selectedSimple);
    onSimpleMode(selectedSimple);
    loadPlan(storageKey)
      .then((value) => {
        if (live.current && generation.current === ownGeneration) {
          setPlan(value);
          setPlanReady(true);
        }
      })
      .catch(() => {
        setMessage(
          "Не удалось открыть личный план. Проверь доступ к хранилищу браузера.",
        );
      });
    snapshots(storageKey)
      .then(setHistory)
      .catch(() => {});
    let pending = false;
    const unsubscribe = api.onChange((all) => {
      changed.current = all.reduce((sum, e) => sum + e.version, 0);
      if (!pending) {
        pending = true;
        win.requestAnimationFrame(() => {
          pending = false;
          if (live.current) {
            setElements(api.getSceneElements());
          }
        });
      }
    });
    const refresh = async () => {
      if (!current) {
        return;
      }
      try {
        const next = await fetchWorkspace(current, win);
        if (!live.current || generation.current !== ownGeneration) {
          return;
        }
        setInfo(next);
        setServerError("");
        onAccess(next.exists ? next.role || "visitor" : null);
        if (next.role === "student" || next.role === "visitor") {
          setSimple(true);
          onSimpleMode(true);
        }
        const all = api.getSceneElementsIncludingDeleted();
        const guarded = enforceProtection(all);
        if (guarded !== all) {
          api.updateScene({
            elements: guarded,
            captureUpdate: CaptureUpdateAction.NEVER,
          });
        }
      } catch (e) {
        if (live.current) {
          setServerError((e as Error).message);
        }
      }
    };
    void refresh();
    const refreshTimer = win.setInterval(refresh, 5000);
    const timer = win.setInterval(async () => {
      if (
        api.getAppState().isLoading ||
        !api.getSceneElements().length ||
        changed.current === saved.current ||
        autoBusy.current ||
        Date.now() - lastAuto.current < 180000
      ) {
        return;
      }
      autoBusy.current = true;
      try {
        await takeSnapshot(storageKey, api, "Автоснимок");
        saved.current = changed.current;
        lastAuto.current = Date.now();
        if (live.current) {
          setHistory(await snapshots(storageKey));
        }
      } catch {
        if (live.current) {
          setMessage(
            "Автоснимок не сохранился. Сохрани доску в файл через меню.",
          );
        }
      } finally {
        autoBusy.current = false;
      }
    }, 30000);
    return () => {
      generation.current = ownGeneration + 1;
      unsubscribe();
      win.clearInterval(refreshTimer);
      win.clearInterval(timer);
    };
  }, [doc, roomHash, api, onAccess, onSimpleMode]);
  useEffect(() => {
    if (!doc || !planReady) {
      return;
    }
    const win = doc.defaultView!;
    const timer = win.setTimeout(() => {
      void savePlan(key, plan).catch(() =>
        setMessage(
          "Личный план не сохранился. Скопируй текст или выгрузи план в файл.",
        ),
      );
    }, 500);
    return () => win.clearTimeout(timer);
  }, [plan, planReady, doc, key]);
  useEffect(() => {
    if (!doc) {
      return;
    }
    const win = doc.defaultView!;
    const params = new URLSearchParams(win.location.search);
    if (params.get("video") === "1") {
      setVideo(true);
    }
    const url = params.get("material");
    if (!url) {
      return;
    }
    if (!trustedMaterialURL(url)) {
      setMessage("Ссылка на материал не относится к сайту lili.math.");
      return;
    }
    let cancelled = false;
    let timer: number;
    const load = async () => {
      if (cancelled) {
        return;
      }
      if (api.getAppState().isLoading) {
        timer = win.setTimeout(load, 300);
        return;
      }
      try {
        busyCount.current++;
        setBusy(true);
        const message = await requestMaterial(
          url,
          params.get("materialTitle") || "Материал из кабинета",
        );
        if (cancelled) {
          return;
        }
        setMessage(message);
        const currentParams = new URLSearchParams(win.location.search);
        if (currentParams.get("material") === url) {
          currentParams.delete("material");
          currentParams.delete("materialTitle");
        }
        win.history.replaceState(
          null,
          "",
          win.location.pathname +
            (currentParams.size ? `?${currentParams}` : "") +
            win.location.hash,
        );
      } catch (e) {
        setMessage((e as Error).message);
      } finally {
        busyCount.current--;
        setBusy(busyCount.current > 0);
      }
    };
    timer = win.setTimeout(load, 700);
    return () => {
      cancelled = true;
      win.clearTimeout(timer);
    };
  }, [doc, api, requestMaterial]);
  useEffect(() => {
    if (panel !== "materials" || catalog.length || !doc) {
      return;
    }
    const controller = new doc.defaultView!.AbortController();
    doc
      .defaultView!.fetch("https://lilimath.ru/catalog.json", {
        signal: controller.signal,
      })
      .then((r) => {
        if (!r.ok) {
          throw new Error();
        }
        return r.json();
      })
      .then((data) =>
        setCatalog(
          (data.items || []).filter(
            (item: Material) =>
              item.status === "public" && trustedMaterialURL(item.file),
          ),
        ),
      )
      .catch((e) => {
        if (e.name !== "AbortError") {
          setMessage(
            "Каталог не загрузился. Материал можно открыть кнопкой «На доску» из кабинета.",
          );
        }
      });
    return () => controller.abort();
  }, [panel, doc, catalog.length]);
  const act = async (action: () => Promise<void>) => {
    if (busy) {
      return;
    }
    busyCount.current++;
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage((e as Error).message || "Не удалось выполнить действие.");
    } finally {
      busyCount.current--;
      setBusy(busyCount.current > 0);
    }
  };
  const open = (next: Panel) => {
    setPanel(panel === next ? null : next);
    setMessage("");
  };
  const copy = async (text: string) => {
    await doc!.defaultView!.navigator.clipboard.writeText(text);
    setMessage("Ссылка скопирована.");
  };
  const toggleSimple = () => {
    const value = !simple;
    setSimple(value);
    onSimpleMode(value);
    try {
      doc?.defaultView!.localStorage.setItem(
        `lili-simple-${key}`,
        value ? "1" : "0",
      );
    } catch {}
  };
  const newLesson = (title: string) => {
    const frame = createLesson(api, title);
    setActive(frame.id);
    setName("");
    setElements(api.getSceneElements());
  };
  const go = (id: string) => {
    setActive(id);
    setActiveLesson(id);
    const frame = api.getSceneElements().find((e) => e.id === id);
    if (frame) {
      api.setViewport({ target: frame, fit: "scale-down", animation: true });
    }
  };
  const follow = () => {
    if (following) {
      collab?.setUserToFollow(null);
      return;
    }
    const others = [...api.getAppState().collaborators.entries()].filter(
      ([id]) => id !== collab?.getSocketId(),
    );
    const id =
      followId ||
      info?.teacherSocketId ||
      (others.length === 1 ? others[0][0] : "");
    const teacher = others.find(([socket]) => socket === id);
    if (!teacher) {
      setMessage(
        others.length
          ? "Выбери преподавателя в списке участников."
          : "Преподаватель пока не подключён к совместной доске.",
      );
      setPanel("lessons");
      return;
    }
    collab?.setUserToFollow({
      socketId: teacher[0] as SocketId,
      username: teacher[1].username || "Преподаватель",
    });
  };
  const protect = () =>
    act(async () => {
      if (!doc || !room || info?.role !== "teacher") {
        throw new Error("Сначала включи защиту по ссылке учителя.");
      }
      const ids = api.getAppState().selectedElementIds;
      const selected = api.getSceneElements().filter((e) => ids[e.id]);
      const chosen = selected.length
        ? selected
        : api.getSceneElements().filter((e) => e.locked);
      if (!chosen.length) {
        throw new Error("Сначала выдели условия или рисунки на доске.");
      }
      const known = protectedIds();
      const chosenIds = new Set(chosen.map((e) => e.id));
      const all = api
        .getSceneElements()
        .filter(
          (e) =>
            known.has(e.id) ||
            chosenIds.has(e.id) ||
            (e.frameId && chosenIds.has(e.frameId)),
        )
        .map((e) => newElementWith(e, { locked: true }));
      await saveProtection(room, all, doc.defaultView!, collab?.getSocketId());
      api.updateScene({
        elements: api
          .getSceneElements()
          .map((e) => all.find((p) => p.id === e.id) || e),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      setMessage(
        "Выбранные объекты защищены. Ученики смогут писать поверх них.",
      );
    });
  const restore = (snapshot: Snapshot) =>
    act(async () => {
      if (api.getAppState().isLoading) {
        throw new Error("Дождись загрузки доски.");
      }
      const originalHash = doc!.defaultView!.location.hash;
      if (
        !doc!.defaultView!.confirm(
          `Восстановить «${snapshot.name}»? Текущая доска сначала сохранится отдельным снимком.`,
        )
      ) {
        return;
      }
      await takeSnapshot(key, api, "Перед восстановлением");
      if (doc!.defaultView!.location.hash !== originalHash) {
        return;
      }
      api.addFiles(Object.values(snapshot.files));
      api.updateScene({
        elements: restoreSnapshot(snapshot, api),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      setHistory(await snapshots(key));
      setMessage(
        "Доска восстановлена. Защищённые условия остаются в актуальной версии.",
      );
    });
  const reveal = (id: string) => {
    const step = plan.steps.find((s) => s.id === id);
    if (!step) {
      return;
    }
    const existing = api
      .getSceneElements()
      .find((e) => e.customData?.liliStep === id);
    if (existing) {
      api.setViewport({ target: existing, fit: "scale-down" });
      return;
    }
    if (step.lessonId) {
      go(step.lessonId);
    }
    const pos = lessonPlacement(api, 800);
    const text = [step.title, step.text]
      .filter(Boolean)
      .join("\n\n")
      .split("\n")
      .map((line) => line.replace(/(.{1,65})(\s+|$)/g, "$1\n").trimEnd())
      .join("\n");
    addLessonElements(api, [
      {
        type: "text",
        ...pos,
        text,
        fontSize: 22,
        strokeColor: "#f3ece2",
        customData: { liliStep: id },
      },
    ]);
    setMessage("Шаг открыт ученику.");
  };
  const collaborators = [...api.getAppState().collaborators.entries()].filter(
    ([id]) => id !== collab?.getSocketId(),
  );
  const tabs: [Panel, string][] = [
    ["lessons", "Уроки"],
    ...(canTeach
      ? ([
          ["templates", "Шаблоны"],
          ["content", "Мои материалы"],
        ] as [Panel, string][])
      : []),
    ...(canTeach ? [["plan", "План и шаги"] as [Panel, string]] : []),
    ["history", "Снимки"],
    ["pdf", "Итоговый PDF"],
    ...(canTeach
      ? ([
          ["materials", "Материалы"],
          ["geometry", "Геометрия"],
          ["access", "Защита"],
        ] as [Panel, string][])
      : []),
  ];
  return (
    <div ref={root} className="lili-workspace">
      <nav className="lili-workspace__bar" aria-label="Управление уроком">
        {doc &&
          new URLSearchParams(doc.defaultView!.location.search).get(
            "personal",
          ) === "1" && (
            <>
              <b>Моя доска</b>
              <a
                className="lili-cabinet-return"
                href="https://lilimath.ru/kabinet.html#lilia"
              >
                В мой кабинет
              </a>
            </>
          )}
        {context && (
          <a className="lili-cabinet-return" href={context.back}>
            В кабинет{context.name ? ` · ${context.name}` : ""}
          </a>
        )}
        {context?.teacher && context.lessonId && (
          <button disabled={savingNow} onClick={() => void finishLesson()}>
            Завершить урок
          </button>
        )}
        <div
          className={`lili-save-status lili-save-status--${saveStatus.state}`}
          role="status"
          aria-live="polite"
        >
          <span>{saveStatusText[saveStatus.state]}</span>
          {history[0] && (
            <small>
              Локальный снимок:{" "}
              {new Date(history[0].created).toLocaleString("ru-RU", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>
          )}
        </div>
        <button disabled={savingNow} onClick={() => void saveNow()}>
          {savingNow ? "Сохраняю…" : "Сохранить сейчас"}
        </button>

        <button onClick={() => open("lessons")}>Уроки</button>
        <button onClick={follow} aria-pressed={!!following}>
          {following ? "Отключить следование" : "За учителем"}
        </button>
        <button onClick={() => setVideo(!video)} aria-pressed={video}>
          Видео
        </button>
        {(!info?.exists || info.role === "teacher") && (
          <button onClick={toggleSimple}>
            {simple ? "Полный вид" : "Простой вид"}
          </button>
        )}
      </nav>
      {pendingMaterials[0] && (
        <MaterialDuplicateDialog
          title={pendingMaterials[0].title}
          busy={busy}
          onCancel={() => setPendingMaterials((current) => current.slice(1))}
          onReuse={() => {
            const found = findMaterial(api, pendingMaterials[0].url);
            if (found[0]) {
              api.setViewport({
                target: found[0],
                fit: "scale-down",
                animation: true,
              });
            } else {
              setMessage("Материал удалён из комнаты. Добавь его заново.");
            }
            setPendingMaterials((current) => current.slice(1));
          }}
          onCopy={() =>
            void act(async () => {
              const pending = pendingMaterials[0];
              setMessage(
                await addMaterial(
                  api,
                  doc!,
                  pending.url,
                  pending.title,
                  setMessage,
                  { duplicate: "copy" },
                ),
              );
              setPendingMaterials((current) => current.slice(1));
            })
          }
        />
      )}
      {simple && (
        <nav className="lili-workspace__pens" aria-label="Инструменты ученика">
          {(
            [
              ["freedraw", "Писать"],
              ["eraser", "Ластик"],
              ["text", "Текст"],
              ["hand", "Двигать"],
            ] as const
          ).map(([type, title]) => (
            <button key={type} onClick={() => api.setActiveTool({ type })}>
              {title}
            </button>
          ))}
        </nav>
      )}
      {panel && (
        <aside className="lili-workspace__panel" aria-label="Панель урока">
          <header>
            <h2>Твой урок</h2>
            <button
              aria-label="Закрыть панель урока"
              onClick={() => setPanel(null)}
            >
              ×
            </button>
          </header>
          <nav className="lili-workspace__tabs">
            {tabs.map(([id, title]) => (
              <button
                key={id}
                aria-pressed={panel === id}
                onClick={() => open(id)}
              >
                {title}
              </button>
            ))}
          </nav>
          {panel === "content" && canTeach && doc && (
            <ContentTemplates
              key={`${key}-${requestTick}`}
              api={api}
              doc={doc}
              workspace={key}
              requested={contentRequested}
              notify={setMessage}
            />
          )}
          {panel === "templates" && canTeach && doc && (
            <LessonTemplates
              api={api}
              doc={doc}
              workspace={key}
              session={context?.lessonId || ""}
              notify={setMessage}
              onApplied={(id) => {
                setActive(id);
                setActiveLesson(id);
                void snapshots(key).then(setHistory);
              }}
            />
          )}
          {panel === "lessons" && (
            <section>
              <h3>Области доски</h3>
              {frames.length ? (
                <ol className="lili-workspace__list">
                  {frames.map((frame) => (
                    <li key={frame.id}>
                      <button
                        aria-pressed={active === frame.id}
                        onClick={() => go(frame.id)}
                      >
                        {frame.type === "frame"
                          ? frame.name || "Без названия"
                          : ""}
                      </button>
                      {canTeach && (
                        <button
                          aria-label="Переименовать область"
                          onClick={() => {
                            const title = doc!.defaultView!.prompt(
                              "Название области",
                              frame.type === "frame" ? frame.name || "" : "",
                            );
                            if (title?.trim()) {
                              api.updateScene({
                                elements: api.getSceneElements().map((e) =>
                                  e.id === frame.id && e.type === "frame"
                                    ? newElementWith(e, {
                                        name: title.trim().slice(0, 100),
                                      })
                                    : e,
                                ),
                                captureUpdate: CaptureUpdateAction.IMMEDIATELY,
                              });
                            }
                          }}
                        >
                          ✎
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p>Здесь появятся разделы урока.</p>
              )}
              {canTeach && (
                <>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (name.trim()) {
                        newLesson(name.trim());
                      }
                    }}
                  >
                    <label>
                      Новая область
                      <input
                        value={name}
                        maxLength={100}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Например: 29 октября · Корни"
                      />
                    </label>
                    <button disabled={!name.trim()}>Создать область</button>
                  </form>
                  <div className="lili-workspace__choices">
                    {[
                      "Повторение",
                      "Новая тема",
                      "Самостоятельная",
                      "Домашнее задание",
                    ].map((t) => (
                      <button key={t} onClick={() => newLesson(t)}>
                        + {t}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setActive("");
                      setActiveLesson("");
                      setMessage(
                        "Новые материалы будут добавляться на свободное поле доски.",
                      );
                    }}
                  >
                    Работать вне областей
                  </button>
                </>
              )}
              <h3>Следовать за преподавателем</h3>
              <label>
                Участник
                <select
                  value={followId}
                  onChange={(e) => setFollowId(e.target.value)}
                >
                  <option value="">Выбрать автоматически</option>
                  {collaborators.map(([id, c]) => (
                    <option key={id} value={id}>
                      {c.username || "Участник"}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={follow}>
                {following ? "Отключить следование" : "За учителем"}
              </button>
              <p className="hint">
                Кнопка возвращает к месту и масштабу преподавателя. Следование
                можно отключить в любой момент.
              </p>
            </section>
          )}
          {panel === "plan" && canTeach && (
            <section>
              <h3>Личный план преподавателя</h3>
              <p className="hint">
                Заметки и неоткрытые шаги хранятся только в этом браузере и не
                отправляются ученику. Для другого устройства выгрузи план в
                файл.
              </p>
              <label>
                Заметки
                <textarea
                  value={plan.notes}
                  maxLength={10000}
                  disabled={!planReady}
                  onChange={(e) => setPlan({ ...plan, notes: e.target.value })}
                />
              </label>
              <h3>Открывать по шагам</h3>
              {plan.steps.map((step, n) => (
                <div className="lili-workspace__step" key={step.id}>
                  <b>
                    {n + 1}. {step.title || "Шаг"}
                  </b>
                  <p>{step.text}</p>
                  <button onClick={() => reveal(step.id)}>
                    Показать ученику
                  </button>
                  <button
                    aria-label="Удалить скрытый шаг из плана"
                    onClick={() =>
                      setPlan({
                        ...plan,
                        steps: plan.steps.filter((s) => s.id !== step.id),
                      })
                    }
                  >
                    Удалить из плана
                  </button>
                </div>
              ))}
              <label>
                Название шага
                <input
                  value={stepTitle}
                  maxLength={100}
                  onChange={(e) => setStepTitle(e.target.value)}
                />
              </label>
              <label>
                Объяснение или подсказка
                <textarea
                  value={stepText}
                  maxLength={3000}
                  onChange={(e) => setStepText(e.target.value)}
                />
              </label>
              <button
                disabled={
                  !stepText.trim() || plan.steps.length >= 40 || !planReady
                }
                onClick={() => {
                  setPlan({
                    ...plan,
                    steps: [
                      ...plan.steps,
                      {
                        id: randomId(),
                        title: stepTitle.trim(),
                        text: stepText.trim(),
                        lessonId: active,
                      },
                    ],
                  });
                  setStepTitle("");
                  setStepText("");
                }}
              >
                Добавить скрытый шаг
              </button>
              <div className="lili-workspace__choices">
                <button
                  onClick={() =>
                    download(
                      doc!,
                      new Blob([JSON.stringify(plan)], {
                        type: "application/json",
                      }),
                      "teacher-lesson-plan.json",
                    )
                  }
                >
                  Выгрузить план
                </button>
                <label className="file">
                  Загрузить план
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void act(async () => {
                          if (file.size > 1000000) {
                            throw new Error("Файл плана слишком большой.");
                          }
                          const value = JSON.parse(await file.text());
                          if (
                            typeof value.notes !== "string" ||
                            !Array.isArray(value.steps) ||
                            value.steps.length > 40 ||
                            value.steps.some(
                              (s: unknown) =>
                                !s ||
                                typeof s !== "object" ||
                                typeof (s as { text?: unknown }).text !==
                                  "string",
                            )
                          ) {
                            throw new Error("Это не файл плана урока.");
                          }
                          setPlan({
                            notes: value.notes.slice(0, 10000),
                            steps: value.steps.map(
                              (s: { title?: string; text: string }) => ({
                                id: randomId(),
                                title: String(s.title || "").slice(0, 100),
                                text: s.text.slice(0, 3000),
                                lessonId: active,
                              }),
                            ),
                          });
                        });
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </section>
          )}
          {panel === "history" && (
            <section>
              <h3>Снимки доски</h3>
              {canTeach && history[0] && (
                <button
                  disabled={busy}
                  onClick={() => void restore(history[0])}
                >
                  Восстановить последний снимок
                </button>
              )}
              <p className="hint">
                До 12 снимков в этом браузере. Автоснимок создаётся при
                изменениях примерно раз в 3 минуты. Очистка данных браузера
                удаляет эту историю.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await takeSnapshot(key, api, "Снимок урока");
                    setHistory(await snapshots(key));
                    setMessage("Снимок сохранён.");
                  })
                }
              >
                Сохранить снимок сейчас
              </button>
              {history.map((s) => (
                <div className="lili-workspace__step" key={s.id}>
                  <b>{s.name}</b>
                  <p>{new Date(s.created).toLocaleString("ru-RU")}</p>
                  {canTeach && (
                    <button disabled={busy} onClick={() => void restore(s)}>
                      Восстановить
                    </button>
                  )}
                  <button
                    onClick={() =>
                      download(
                        doc!,
                        new Blob(
                          [
                            JSON.stringify({
                              type: "excalidraw",
                              version: 2,
                              source: "lili.math",
                              elements: s.elements,
                              files: s.files,
                              appState: { viewBackgroundColor: "#14211e" },
                            }),
                          ],
                          { type: "application/json" },
                        ),
                        "lesson-snapshot.excalidraw",
                      )
                    }
                  >
                    Скачать файл
                  </button>
                </div>
              ))}
              {!history.length && <p>Снимков пока нет.</p>}
            </section>
          )}
          {panel === "pdf" && (
            <section>
              <h3>Итог занятия</h3>
              <p>
                Выбери области для печати. Без отметок выгружаются все области,
                а если их нет — вся доска.
              </p>
              {frames.map((frame) => (
                <label className="check" key={frame.id}>
                  <input
                    type="checkbox"
                    checked={pdfFrames.includes(frame.id)}
                    onChange={(e) =>
                      setPdfFrames(
                        e.target.checked
                          ? [...pdfFrames, frame.id]
                          : pdfFrames.filter((id) => id !== frame.id),
                      )
                    }
                  />
                  {frame.type === "frame" ? frame.name : ""}
                </label>
              ))}
              <label className="check">
                <input
                  type="checkbox"
                  checked={squared}
                  onChange={(e) => setSquared(e.target.checked)}
                />
                Клетки как в тетради
              </label>
              <button
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    setMessage("Готовлю PDF…");
                    await exportLessonPDF(api, doc!, pdfFrames, squared);
                    setMessage("PDF готов.");
                  })
                }
              >
                Скачать итоговый PDF
              </button>
              <p className="hint">
                Светлый фон, компактные поля. Длинное решение распределяется по
                страницам. Для интерактивного задания распечатывай его исходный
                PDF: содержимое встроенных сайтов не входит в экспорт доски.
              </p>
            </section>
          )}
          {panel === "materials" && canTeach && (
            <section>
              <h3>Материалы lili.math</h3>
              <p className="hint">
                Назначенную работу можно добавить кнопкой «На доску» из кабинета
                ученика. Здесь общий публичный каталог.
              </p>
              <label>
                Поиск
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Трапеция, корни, проценты…"
                />
              </label>
              <label>
                Класс
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                >
                  <option value="">Все классы</option>
                  {[5, 6, 7, 8, 9].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              {catalog
                .filter(
                  (m) =>
                    (!grade || String(m.class) === grade) &&
                    m.title.toLowerCase().includes(query.toLowerCase()),
                )
                .slice(0, 35)
                .map((m) => (
                  <div className="lili-workspace__step" key={m.file}>
                    <b>{m.title}</b>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void act(async () => {
                          setMessage(await requestMaterial(m.file, m.title));
                        })
                      }
                    >
                      Добавить на доску
                    </button>
                    <a
                      href={trustedMaterialURL(m.file)!}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Открыть отдельно
                    </a>
                  </div>
                ))}
              {!catalog.length && <p>Загружаю каталог…</p>}
            </section>
          )}
          {panel === "geometry" && canTeach && (
            <section>
              <h3>Геометрические инструменты</h3>
              <label>
                Инструмент
                <select
                  value={geometry}
                  onChange={(e) => {
                    const value = e.target.value as GeometryTool;
                    setGeometry(value);
                    setSize(value === "angle" ? "60" : "5");
                  }}
                >
                  <option value="angle">Угол по величине</option>
                  <option value="ruler">Линейка по клеткам</option>
                  <option value="protractor">Транспортир</option>
                  <option value="perpendicular">
                    Перпендикуляр и прямой угол
                  </option>
                  <option value="circle">Окружность по радиусу</option>
                  <option value="triangle">Прямоугольный треугольник</option>
                  <option value="equal">Отметка равенства сторон</option>
                </select>
              </label>
              {["angle", "circle", "triangle"].includes(geometry) && (
                <label>
                  {geometry === "angle"
                    ? "Угол, градусы"
                    : geometry === "circle"
                    ? "Радиус, клетки"
                    : "Горизонтальный катет, клетки"}
                  <input
                    type="number"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                  />
                </label>
              )}
              <button
                onClick={() => {
                  try {
                    const place = lessonPlacement(api, 600);
                    addLessonElements(
                      api,
                      geometryElements(
                        geometry,
                        ["angle", "circle", "triangle"].includes(geometry)
                          ? Number(size)
                          : 5,
                        place.x,
                        place.y,
                        randomId(),
                        place.frameId,
                        api.getAppState().gridSize || 30,
                      ),
                      place,
                    );
                    setMessage(
                      "Построение добавлено. Его элементы сгруппированы.",
                    );
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
                }}
              >
                Добавить инструмент
              </button>
              <p className="hint">
                Одна клетка соответствует {api.getAppState().gridSize || 30}{" "}
                единицам доски. Построения и подписи можно перемещать и
                поворачивать. Числа не пересчитываются после ручного изменения
                размеров.
              </p>
            </section>
          )}
          {panel === "access" && canTeach && (
            <section>
              <h3>Права и защищённые задания</h3>
              {!room ? (
                <p>
                  Сначала создай совместную доску через кнопку общего доступа.
                </p>
              ) : !info?.exists ? (
                <>
                  <p>
                    Выдели условие, рисунок или область урока и закрепи их.
                    Ученик сможет писать рядом, а закреплённые объекты будут
                    защищены от случайного перемещения и удаления.
                  </p>
                  <p>Закреплено объектов: {clientPinnedIds().size}.</p>
                  <button
                    disabled={busy || !clientReady}
                    onClick={() =>
                      void act(async () => {
                        const selected = api.getAppState().selectedElementIds;
                        if (!Object.values(selected).some(Boolean)) {
                          throw new Error("Сначала выдели задание на доске.");
                        }
                        await claimClientWorkspace(room, doc!.defaultView!);
                        const pinned = pinElements(
                          api.getSceneElementsIncludingDeleted(),
                          selected,
                        );
                        api.updateScene({
                          elements: pinned,
                          appState: { selectedElementIds: {} },
                          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
                        });
                        setElements(api.getSceneElements());
                        setMessage(
                          "Задание закреплено. Сохрани ссылку учителя, а ученику отправь ученическую ссылку.",
                        );
                      })
                    }
                  >
                    Закрепить выделенное задание
                  </button>
                  <button
                    disabled={busy || !clientPinnedIds().size}
                    onClick={() =>
                      void act(async () => {
                        const unpinned = unpinElements(
                          api.getSceneElementsIncludingDeleted(),
                          clientPinnedIds(),
                        );
                        api.updateScene({
                          elements: unpinned,
                          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
                        });
                        setElements(api.getSceneElements());
                        setMessage(
                          "Закрепление снято с твоих заданий. Их снова можно редактировать.",
                        );
                      })
                    }
                  >
                    Снять закрепление с моих заданий
                  </button>
                  <button
                    disabled={busy || !clientReady}
                    onClick={() =>
                      void act(async () => {
                        await claimClientWorkspace(room, doc!.defaultView!);
                        await copy(recoveryLink(doc!.defaultView!)!);
                      })
                    }
                  >
                    Скопировать ссылку учителя
                  </button>
                  <button
                    onClick={() =>
                      void act(async () => {
                        await copy(
                          decorateInvite(
                            room.id,
                            `${doc!.defaultView!.location.origin}${
                              doc!.defaultView!.location.pathname
                            }#room=${room.id},${room.key}`,
                          ),
                        );
                      })
                    }
                  >
                    Скопировать ссылку ученика
                  </button>
                  <p className="hint">
                    Закрепление работает без обновления сервера. Оно защищает от
                    случайных действий в этой доске, но не от намеренного
                    обхода. Ссылка учителя нужна для снятия закрепления на
                    другом устройстве. Старые версии приложения могут не
                    поддерживать закрепление: перед уроком обновите страницу.
                  </p>
                  {!serverError && info && (
                    <details>
                      <summary>Серверная защита</summary>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void act(async () => {
                            const next = await claimWorkspace(
                              room,
                              doc!.defaultView!,
                            );
                            setInfo(next);
                            onAccess(next.role || "visitor");
                            collab?.refreshWorkspaceAccess();
                          })
                        }
                      >
                        Включить проверку прав на сервере
                      </button>
                    </details>
                  )}
                </>
              ) : info.role === "teacher" ? (
                <>
                  <p>
                    Открыта доска учителя. Защищено объектов:{" "}
                    {protectedIds().size}.
                  </p>
                  <button disabled={busy} onClick={() => void protect()}>
                    Защитить выделенное или закреплённые фоны
                  </button>
                  <button
                    disabled={busy || !protectedIds().size}
                    onClick={() =>
                      void act(async () => {
                        await saveProtection(
                          room,
                          [],
                          doc!.defaultView!,
                          collab?.getSocketId(),
                        );
                        setMessage(
                          "Серверная защита снята. При необходимости разблокируй объекты через контекстное меню.",
                        );
                      })
                    }
                  >
                    Снять защиту со всех объектов
                  </button>
                  <button
                    onClick={() =>
                      void act(async () => {
                        const link = recoveryLink(doc!.defaultView!);
                        if (link) {
                          await copy(link);
                        }
                      })
                    }
                  >
                    Скопировать ссылку учителя
                  </button>
                  <button
                    onClick={() =>
                      void act(async () => {
                        await copy(
                          decorateInvite(
                            room.id,
                            `${doc!.defaultView!.location.origin}${
                              doc!.defaultView!.location.pathname
                            }#room=${room.id},${room.key}`,
                          ),
                        );
                      })
                    }
                  >
                    Скопировать ссылку ученика
                  </button>
                  <button
                    disabled={busy || !collab?.getSocketId()}
                    onClick={() =>
                      void act(async () => {
                        const ids = protectedIds();
                        await saveProtection(
                          room,
                          api.getSceneElements().filter((e) => ids.has(e.id)),
                          doc!.defaultView!,
                          collab?.getSocketId(),
                        );
                        setInfo(await fetchWorkspace(room, doc!.defaultView!));
                        setMessage(
                          "Ты отмечена преподавателем для кнопки «За учителем».",
                        );
                      })
                    }
                  >
                    Я веду этот урок
                  </button>
                  <p className="hint">
                    Ссылку учителя сохрани отдельно для другого устройства.
                    Ученик с новой ссылкой сможет писать, но не сможет менять
                    защищённый слой.
                  </p>
                </>
              ) : (
                <p>Открыта доска ученика. Защиту меняет преподаватель.</p>
              )}
            </section>
          )}
          {busy && <p role="status">Выполняю…</p>}
          {message && (
            <p className="lili-workspace__message" role="status">
              {message}
            </p>
          )}
        </aside>
      )}
      {!panel && message && (
        <div className="lili-workspace__notice" role="status">
          {message}
          <button aria-label="Скрыть сообщение" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}
      {info?.exists && info.role === "visitor" && (
        <div className="lili-workspace__notice">
          Для записи нужна ссылка ученика или учителя. Сейчас доступен просмотр.
        </div>
      )}
      {clientStudent && !info?.exists && (
        <div className="lili-workspace__notice" role="status">
          Задание закреплено учителем. Пиши решение рядом или поверх задания.
        </div>
      )}
      {video && doc && (
        <VideoCall collab={collab} doc={doc} onClose={() => setVideo(false)} />
      )}
    </div>
  );
};
