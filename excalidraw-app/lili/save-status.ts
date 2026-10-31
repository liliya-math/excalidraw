export type BoardSaveStatus = {
  state: "local" | "connecting" | "offline" | "saving" | "saved" | "error";
  savedAt?: number;
};

export const boardSaveStatus = (input: {
  collaborating: boolean;
  connected: boolean;
  initialized: boolean;
  offline: boolean;
  saving: boolean;
  failed: boolean;
  saved: boolean;
  savedAt: number;
}): BoardSaveStatus => {
  if (!input.collaborating) {
    return { state: "local" };
  }
  if (input.offline || !input.connected) {
    return { state: "offline", savedAt: input.savedAt };
  }
  if (!input.initialized) {
    return { state: "connecting" };
  }
  if (input.failed) {
    return { state: "error", savedAt: input.savedAt };
  }
  if (input.saving || !input.saved) {
    return { state: "saving", savedAt: input.savedAt };
  }
  return { state: "saved", savedAt: input.savedAt };
};

export const saveStatusText: Record<BoardSaveStatus["state"], string> = {
  local: "Локальная доска",
  connecting: "Подключаю комнату…",
  offline: "Нет связи с комнатой",
  saving: "Есть несохранённые изменения",
  saved: "Сохранено на сервере",
  error: "Не удалось сохранить на сервере",
};
