export type CabinetContext = {
  code: string;
  teacher: boolean;
  name: string;
  lessonId: string;
  date: string;
  title: string;
  start: boolean;
  back: string;
};

export const cabinetContext = (search: string): CabinetContext | null => {
  const params = new URLSearchParams(search);
  const code = params.get("cabinet") || "";
  if (!/^[a-z0-9]{1,100}$/i.test(code)) {
    return null;
  }
  const teacher = params.get("cabinetRole") === "teacher";
  const rawId = params.get("lessonId") || "";
  const lessonId = /^[a-z0-9-]{1,100}$/i.test(rawId) ? rawId : "";
  const rawDate = params.get("lessonDate") || "";
  const date =
    /^\d{4}-\d{2}-\d{2}$/.test(rawDate) &&
    Number.isFinite(Date.parse(`${rawDate}T00:00:00Z`)) &&
    new Date(`${rawDate}T00:00:00Z`).toISOString().slice(0, 10) === rawDate
      ? rawDate
      : "";
  // A fixed first-party return destination, never a URL from query input.
  const back = new URL("https://lilimath.ru/kabinet.html");
  if (teacher && lessonId) {
    back.searchParams.set("lesson", lessonId);
  }
  back.hash = teacher ? `lilia-${code}` : code;
  return {
    code,
    teacher,
    lessonId,
    date,
    name: (params.get("studentName") || "").slice(0, 80),
    title: (params.get("lessonTitle") || "").slice(0, 300),
    start: teacher && !!lessonId && !!date && params.get("startLesson") === "1",
    back: back.href,
  };
};
