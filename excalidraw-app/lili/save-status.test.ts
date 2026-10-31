import { describe, expect, it } from "vitest";

import { boardSaveStatus } from "./save-status";
import { cabinetContext } from "./cabinet-context";
const persisted = {
  collaborating: true,
  connected: true,
  initialized: true,
  offline: false,
  saving: false,
  failed: false,
  saved: true,
  savedAt: 123,
};
describe("lesson logistics", () => {
  it("never reports unsaved, failed or pending media writes as persisted", () => {
    expect(boardSaveStatus(persisted).state).toBe("saved");
    expect(boardSaveStatus({ ...persisted, saved: false }).state).toBe(
      "saving",
    );
    expect(boardSaveStatus({ ...persisted, saving: true }).state).toBe(
      "saving",
    );
    expect(boardSaveStatus({ ...persisted, failed: true }).state).toBe("error");
    expect(boardSaveStatus({ ...persisted, connected: false }).state).toBe(
      "offline",
    );
    expect(boardSaveStatus({ ...persisted, offline: true }).state).toBe(
      "offline",
    );
    expect(boardSaveStatus({ ...persisted, initialized: false }).state).toBe(
      "connecting",
    );
    expect(boardSaveStatus({ ...persisted, collaborating: false }).state).toBe(
      "local",
    );
  });
  it("only builds first-party cabinet returns and keeps role-specific routes", () => {
    const teacher = cabinetContext(
      "?cabinet=alice&cabinetRole=teacher&lessonId=abc-123&lessonDate=2026-10-31&startLesson=1&return=https://evil.example",
    );
    expect(teacher?.back).toBe(
      "https://lilimath.ru/kabinet.html?lesson=abc-123#lilia-alice",
    );
    expect(teacher?.start).toBe(true);
    expect(teacher?.finishBack).toBe(
      "https://lilimath.ru/kabinet.html?lesson=abc-123&finish=1#lilia-alice",
    );
    const pupil = cabinetContext(
      "?cabinet=alice&cabinetRole=student&lessonId=abc-123&lessonDate=2026-10-31&startLesson=1",
    );
    expect(pupil?.back).toBe("https://lilimath.ru/kabinet.html#alice");
    expect(pupil?.start).toBe(false);
    expect(cabinetContext("?cabinet=alice&lessonDate=2026-02-30")?.date).toBe(
      "",
    );
    expect(cabinetContext("?cabinet=https://evil.example")).toBe(null);
  });
});
