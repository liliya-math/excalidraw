import { describe, expect, it, vi } from "vitest";

import { syncCloudLibrary } from "./cloud-library";
import {
  listContentTemplates,
  mergeContentLibraries,
  replaceContentLibrary,
} from "./content-templates";
vi.mock("./content-templates", () => ({
  listContentTemplates: vi.fn(async () => []),
  mergeContentLibraries: vi.fn((a, b) => [...a, ...b]),
  replaceContentLibrary: vi.fn(async () => {}),
}));
function environment() {
  let listener: (event: MessageEvent) => Promise<void>;
  const popup = { postMessage: vi.fn() };
  const win = {
    crypto: { randomUUID: () => "12345678-1234-1234-1234-123456789012" },
    open: vi.fn(() => popup),
    setTimeout,
    clearTimeout,
    addEventListener: (_type: string, fn: typeof listener) => {
      listener = fn;
    },
    removeEventListener: vi.fn(),
  };
  const send = (
    data: unknown,
    origin = "https://lilimath.ru",
    source = popup,
  ) =>
    listener({
      data: {
        type: "lili-cloud-account",
        nonce: "12345678-1234-1234-1234-123456789012",
        ...(data as object),
      },
      origin,
      source,
    } as unknown as MessageEvent);
  return { doc: { defaultView: win } as unknown as Document, win, popup, send };
}
describe("account bridge", () => {
  it("checks source and origin, and commits local merge only after server acknowledgement", async () => {
    vi.clearAllMocks();
    const e = environment();
    const done = syncCloudLibrary(e.doc);
    await e.send({ stage: "ready" }, "https://evil.example");
    expect(e.popup.postMessage).not.toHaveBeenCalled();
    await e.send({ stage: "ready" });
    expect(e.popup.postMessage.mock.calls[0][0].action).toBe("get");
    await e.send({
      stage: "loaded",
      data: { version: 1, revision: 2, templates: [] },
    });
    expect(listContentTemplates).toHaveBeenCalledWith(true);
    expect(mergeContentLibraries).toHaveBeenCalled();
    expect(replaceContentLibrary).not.toHaveBeenCalled();
    expect(e.popup.postMessage.mock.calls[1][0]).toMatchObject({
      action: "put",
      revision: 2,
      templates: [],
    });
    expect(JSON.stringify(e.popup.postMessage.mock.calls)).not.toContain(
      "password",
    );
    await e.send({
      stage: "saved",
      data: { version: 1, revision: 3, templates: [] },
    });
    expect(await done).toBe(0);
    expect(replaceContentLibrary).toHaveBeenCalledWith([]);
    expect(e.win.removeEventListener).toHaveBeenCalled();
  });
  it("leaves local storage unchanged if server rejects a conflicting revision", async () => {
    vi.clearAllMocks();
    const e = environment();
    const done = syncCloudLibrary(e.doc);
    const rejected = expect(done).rejects.toThrow("changed");
    await e.send({ error: "changed" });
    await rejected;
    expect(replaceContentLibrary).not.toHaveBeenCalled();
  });
});
