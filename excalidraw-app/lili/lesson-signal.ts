export type LessonSignal = {
  from: string;
  to?: string;
  kind: "hello" | "ready" | "offer" | "answer" | "ice" | "hangup";
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};
