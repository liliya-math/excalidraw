import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react";

import { VideoCall } from "./VideoCall";

import type { CollabAPI } from "../collab/Collab";
import type { LessonSignal } from "./lesson-signal";

it("negotiates both participants even when ICE arrives before hello and stops media on close", async () => {
  const stopped = vi.fn();
  const tracks = [{ stop: stopped, enabled: true, kind: "video" }];
  const media = { getTracks: () => tracks };
  const peers: FakePeer[] = [];
  class FakePeer {
    localDescription: {
      type: string;
      toJSON: () => { type: string; sdp: string };
    } | null = null;
    remoteDescription: unknown = null;
    connectionState = "new";
    onicecandidate: ((event: unknown) => void) | null = null;
    onconnectionstatechange: (() => void) | null = null;
    ontrack = null;
    offers = 0;
    closed = false;
    constructor() {
      peers.push(this);
    }
    addTrack() {}
    async createOffer() {
      this.offers++;
      return { type: "offer", sdp: "offer" };
    }
    async createAnswer() {
      expect(this.remoteDescription).toBeTruthy();
      return { type: "answer", sdp: "answer" };
    }
    connected() {
      this.connectionState = "connected";
      this.onconnectionstatechange?.();
    }
    async setLocalDescription(value: { type: string; sdp: string }) {
      this.localDescription = { ...value, toJSON: () => value };
      this.onicecandidate?.({
        candidate: { toJSON: () => ({ candidate: "host" }) },
      });
      if (value.type === "answer") {
        this.connected();
      }
    }
    async setRemoteDescription(value: { type: string }) {
      if (value.type === "answer") {
        expect(this.localDescription?.type).toBe("offer");
      }
      this.remoteDescription = value;
      if (value.type === "answer") {
        this.connected();
      }
    }
    async addIceCandidate() {
      expect(this.remoteDescription).toBeTruthy();
    }
    close() {
      this.closed = true;
    }
  }
  const rtc = Object.getOwnPropertyDescriptor(window, "RTCPeerConnection");
  const devices = Object.getOwnPropertyDescriptor(
    window.navigator,
    "mediaDevices",
  );
  Object.defineProperty(window, "RTCPeerConnection", {
    configurable: true,
    value: FakePeer,
  });
  Object.defineProperty(window.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: async () => media },
  });
  vi.spyOn(window, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ iceServers: [] })),
  );
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  const listeners = new Map<string, (signal: LessonSignal) => void>();
  const api = (from: string) =>
    ({
      getSocketId: () => from,
      isCollaborating: () => true,
      subscribeLessonSignal: (listener: (signal: LessonSignal) => void) => {
        listeners.set(from, listener);
        return () => {
          listeners.delete(from);
        };
      },
      sendLessonSignal: async (signal: Omit<LessonSignal, "from">) => {
        for (const [id, receive] of listeners) {
          if (id !== from) {
            receive({ ...signal, from });
          }
        }
      },
    } as unknown as CollabAPI);
  const first = render(
    <VideoCall collab={api("a")} doc={document} onClose={() => {}} />,
  );
  const second = render(
    <VideoCall collab={api("b")} doc={document} onClose={() => {}} />,
  );
  try {
    fireEvent.click(
      first.container.querySelector(".lili-video__actions button")!,
    );
    await waitFor(() =>
      expect(first.container.textContent).toContain("Ожидаю собеседника"),
    );
    await act(async () => {
      listeners.get("a")?.({
        kind: "ice",
        from: "b",
        candidate: { candidate: "early" },
      });
    });
    expect(peers).toHaveLength(0);
    fireEvent.click(
      second.container.querySelector(".lili-video__actions button")!,
    );
    await waitFor(() =>
      expect(first.container.textContent).toContain("Вы на связи"),
    );
    await waitFor(() =>
      expect(second.container.textContent).toContain("Вы на связи"),
    );
    expect(peers.reduce((sum, p) => sum + p.offers, 0)).toBe(1);
  } finally {
    first.unmount();
    second.unmount();
    expect(stopped).toHaveBeenCalledTimes(2);
    expect(peers.every((p) => p.closed)).toBe(true);
    if (rtc) {
      Object.defineProperty(window, "RTCPeerConnection", rtc);
    } else {
      Reflect.deleteProperty(window, "RTCPeerConnection");
    }
    if (devices) {
      Object.defineProperty(window.navigator, "mediaDevices", devices);
    } else {
      Reflect.deleteProperty(window.navigator, "mediaDevices");
    }
    vi.restoreAllMocks();
  }
});
