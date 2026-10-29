import React, { useEffect, useRef, useState } from "react";

import { storageBase, workspaceHeaders, readRoom } from "./workspace";

import type { CollabAPI } from "../collab/Collab";
import type { LessonSignal } from "./lesson-signal";

export const VideoCall = ({
  collab,
  doc,
  onClose,
}: {
  collab: CollabAPI | null;
  doc: Document;
  onClose: () => void;
}) => {
  const win = doc.defaultView!;
  const local = useRef<HTMLVideoElement>(null);
  const remote = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const peer = useRef<RTCPeerConnection | null>(null);
  const partner = useRef("");
  const candidates = useRef<RTCIceCandidateInit[]>([]);
  const live = useRef(false);
  const disposed = useRef(false);
  const chain = useRef(Promise.resolve());
  const ice = useRef<RTCIceServer[]>([
    { urls: "stun:stun.cloudflare.com:3478" },
  ]);
  const [status, setStatus] = useState(
    "Включи камеру. Собеседник должен открыть эту же доску и включить видеосвязь.",
  );
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [small, setSmall] = useState(false);
  const [position, setPosition] = useState({
    x: Math.max(8, win.innerWidth - 340),
    y: 100,
  });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const stopPeer = () => {
    peer.current?.close();
    peer.current = null;
    partner.current = "";
    candidates.current = [];
    if (remote.current) {
      remote.current.srcObject = null;
    }
  };
  const leave = () => {
    if (partner.current) {
      void collab
        ?.sendLessonSignal({ kind: "hangup", to: partner.current })
        .catch(() => {});
    }
    live.current = false;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    stopPeer();
    setJoined(false);
    if (local.current) {
      local.current.srcObject = null;
    }
  };
  const makePeer = (id: string) => {
    if (peer.current) {
      return peer.current;
    }
    partner.current = id;
    const pc = new win.RTCPeerConnection({ iceServers: ice.current });
    peer.current = pc;
    stream.current
      ?.getTracks()
      .forEach((track) => pc.addTrack(track, stream.current!));
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void collab
          ?.sendLessonSignal({
            kind: "ice",
            to: id,
            candidate: event.candidate.toJSON(),
          })
          .catch(() => {});
      }
    };
    pc.ontrack = (event) => {
      if (remote.current) {
        remote.current.srcObject =
          event.streams[0] || new win.MediaStream([event.track]);
        void remote.current
          .play()
          .catch(() => setStatus("Нажми на видео, чтобы включить звук."));
      }
    };
    pc.onconnectionstatechange = () => {
      if (disposed.current) {
        return;
      }
      if (pc.connectionState === "connected") {
        setStatus("Вы на связи");
      } else if (pc.connectionState === "failed") {
        setStatus(
          "Прямое соединение не установилось. Для этой сети нужен TURN на сервере. Можно выйти и подключиться снова.",
        );
      } else if (pc.connectionState === "disconnected") {
        setStatus("Соединение прервалось. Ожидаю восстановления…");
      }
    };
    return pc;
  };
  const receive = async (signal: LessonSignal) => {
    const self = collab?.getSocketId();
    if (
      !live.current ||
      !self ||
      signal.from === self ||
      (signal.to && signal.to !== self)
    ) {
      return;
    }
    if (partner.current && partner.current !== signal.from) {
      return;
    }
    if (signal.kind === "hangup") {
      stopPeer();
      setStatus("Собеседник вышел. Ожидаю подключения…");
      return;
    }
    if (signal.kind === "hello" || signal.kind === "ready") {
      if (signal.kind === "hello") {
        await collab?.sendLessonSignal({ kind: "ready", to: signal.from });
      }
      if (self < signal.from && !peer.current) {
        const pc = makePeer(signal.from);
        setStatus("Соединяю…");
        await pc.setLocalDescription(await pc.createOffer());
        await collab?.sendLessonSignal({
          kind: "offer",
          to: signal.from,
          description: pc.localDescription!.toJSON(),
        });
      }
      return;
    }
    // ICE can arrive before the offer. Queue it without creating a peer, so
    // the deterministic offerer is still allowed to start negotiation.
    if (signal.kind === "ice" && signal.candidate && !peer.current) {
      candidates.current.push(signal.candidate);
      return;
    }
    const pc = makePeer(signal.from);
    if (signal.kind === "offer" && signal.description) {
      setStatus("Соединяю…");
      await pc.setRemoteDescription(signal.description);
      for (const candidate of candidates.current) {
        await pc.addIceCandidate(candidate);
      }
      candidates.current = [];
      await pc.setLocalDescription(await pc.createAnswer());
      await collab?.sendLessonSignal({
        kind: "answer",
        to: signal.from,
        description: pc.localDescription!.toJSON(),
      });
    } else if (signal.kind === "answer" && signal.description) {
      await pc.setRemoteDescription(signal.description);
      for (const candidate of candidates.current) {
        await pc.addIceCandidate(candidate);
      }
      candidates.current = [];
    } else if (signal.kind === "ice" && signal.candidate) {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(signal.candidate);
      } else {
        candidates.current.push(signal.candidate);
      }
    }
  };
  const receiveRef = useRef(receive);
  receiveRef.current = receive;
  useEffect(() => {
    disposed.current = false;
    const unsubscribe = collab?.subscribeLessonSignal((signal) => {
      chain.current = chain.current
        .then(() => receiveRef.current(signal))
        .catch(() => {
          if (!disposed.current) {
            setStatus(
              "Не удалось согласовать соединение. Выйди и подключись снова.",
            );
          }
        });
    });
    return () => {
      disposed.current = true;
      unsubscribe?.();
      live.current = false;
      stream.current?.getTracks().forEach((t) => t.stop());
      peer.current?.close();
    };
  }, [collab]);
  const join = async () => {
    if (!collab?.getSocketId() || !collab.isCollaborating()) {
      setStatus("Сначала создай совместную доску или открой ссылку ученика.");
      return;
    }
    setBusy(true);
    try {
      if (!win.navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Камера недоступна. Открой доску по HTTPS в современном браузере.",
        );
      }
      try {
        const response = await win.fetch(
          `${storageBase}/ice?room=${readRoom(win.location.hash)?.id || ""}`,
          {
            headers: workspaceHeaders(),
            signal: win.AbortSignal.timeout(5000),
          },
        );
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.iceServers)) {
            ice.current = data.iceServers;
          }
        }
      } catch {
        /* Direct STUN remains available. */
      }
      const media = await win.navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (disposed.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      live.current = true;
      if (local.current) {
        local.current.srcObject = media;
        void local.current.play();
      }
      setJoined(true);
      setMic(true);
      setCam(true);
      setStatus("Ожидаю собеседника…");
      await collab.sendLessonSignal({ kind: "hello" });
    } catch (e) {
      leave();
      setStatus(
        (e as Error).name === "NotAllowedError"
          ? "Разреши доступ к камере и микрофону в настройках браузера."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className={`lili-video ${small ? "compact" : ""}`}
      style={{ left: position.x, top: position.y }}
      aria-label="Видеосвязь"
    >
      <header
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) {
            return;
          }
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            px: position.x,
            py: position.y,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) {
            setPosition({
              x: Math.max(
                0,
                Math.min(win.innerWidth - 100, d.px + e.clientX - d.x),
              ),
              y: Math.max(
                0,
                Math.min(win.innerHeight - 70, d.py + e.clientY - d.y),
              ),
            });
          }
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <b>Видеосвязь</b>
        <button
          onClick={() => setSmall(!small)}
          aria-label={small ? "Развернуть видео" : "Свернуть видео"}
        >
          {small ? "▢" : "−"}
        </button>
        <button
          onClick={() => {
            leave();
            onClose();
          }}
          aria-label="Завершить звонок и закрыть"
        >
          ×
        </button>
      </header>
      <div className="lili-video__feeds">
        <video
          ref={remote}
          autoPlay
          playsInline
          onClick={() => void remote.current?.play()}
          aria-label="Видео собеседника"
        />
        <video ref={local} autoPlay playsInline muted aria-label="Моё видео" />
      </div>
      {!small && (
        <>
          <p role="status">{status}</p>
          <div className="lili-video__actions">
            {!joined ? (
              <button disabled={busy} onClick={join}>
                {busy ? "Подключаю…" : "Включить камеру и подключиться"}
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    stream.current?.getAudioTracks().forEach((t) => {
                      t.enabled = !mic;
                    });
                    setMic(!mic);
                  }}
                >
                  {mic ? "Микрофон: вкл" : "Микрофон: выкл"}
                </button>
                <button
                  onClick={() => {
                    stream.current?.getVideoTracks().forEach((t) => {
                      t.enabled = !cam;
                    });
                    setCam(!cam);
                  }}
                >
                  {cam ? "Камера: вкл" : "Камера: выкл"}
                </button>
                <button
                  onClick={() => {
                    leave();
                    setStatus("Звонок завершён.");
                  }}
                >
                  Выйти
                </button>
                {doc.pictureInPictureEnabled && (
                  <button
                    onClick={() => {
                      void remote.current
                        ?.requestPictureInPicture()
                        .catch(() =>
                          setStatus("Сначала дождись видео собеседника."),
                        );
                    }}
                  >
                    Поверх окон
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
};
