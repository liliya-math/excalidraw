// lili.math: a permanent board per student. Each board is a collaboration
// room whose drawing is stored on our server, so the tutor and the student
// can open the same link at any time and find everything in place.

import React, { useEffect, useMemo, useState } from "react";

import {
  generateCollaborationLinkData,
  getCollaborationLink,
  getCollaborationLinkData,
} from "../data";

import "./StudentBoards.scss";

export type StudentBoard = { name: string; link: string; created: number };

const STORAGE_KEY = "lili-student-boards";

export const loadStudentBoards = (): StudentBoard[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const saveStudentBoards = (boards: StudentBoard[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
  } catch (error) {
    console.error(error);
  }
};

const roomIdOf = (link: string) => getCollaborationLinkData(link)?.roomId;

const copy = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    window.prompt("Скопируйте ссылку:", value);
    return false;
  }
};

const openBoard = (link: string) => {
  window.location.assign(link);
  window.location.reload();
};

/** shows whose board is open, when the current room is a saved student board */
export const StudentBoardBadge = () => {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const name = useMemo(() => {
    const roomId = roomIdOf(window.location.href);
    if (!roomId) {
      return null;
    }
    return (
      loadStudentBoards().find((b) => roomIdOf(b.link) === roomId)?.name ??
      null
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);
  if (!name) {
    return null;
  }
  return <div className="lili-board-badge">Доска: {name}</div>;
};

export const StudentBoardsDialog = ({ onClose }: { onClose: () => void }) => {
  const [boards, setBoards] = useState<StudentBoard[]>(loadStudentBoards);
  const [name, setName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const currentRoom = roomIdOf(window.location.href);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const update = (next: StudentBoard[]) => {
    setBoards(next);
    saveStudentBoards(next);
  };

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) {
      return;
    }
    setBusy(true);
    try {
      const data = await generateCollaborationLinkData();
      const link = getCollaborationLink(data);
      const next = [{ name: trimmed, link, created: Date.now() }, ...boards];
      update(next);
      setName("");
      if (await copy(link)) {
        setCopied(link);
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = (board: StudentBoard) => {
    if (
      window.confirm(
        `Убрать «${board.name}» из списка? Рисунки на сервере останутся, ` +
          `и по старой ссылке доска откроется. Но сюда её будет не вернуть, ` +
          `если ссылка нигде не сохранена.`,
      )
    ) {
      update(boards.filter((b) => b !== board));
    }
  };

  return (
    <div className="lili-boards-overlay" onPointerDown={onClose}>
      <div
        className="lili-boards"
        role="dialog"
        aria-label="Доски учеников"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="lili-boards__head">
          <h2>Доски учеников</h2>
          <button
            className="lili-boards__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <p className="lili-boards__hint">
          У каждого ученика своя постоянная доска. Отправь ему ссылку один раз:
          вы оба открываете её когда угодно, и всё нарисованное сохраняется.
        </p>

        <form
          className="lili-boards__new"
          onSubmit={(event) => {
            event.preventDefault();
            create();
          }}
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Имя ученика"
            maxLength={60}
            autoFocus
          />
          <button type="submit" disabled={!name.trim() || busy}>
            Создать доску
          </button>
        </form>

        {boards.length === 0 ? (
          <p className="lili-boards__empty">Пока ни одной доски.</p>
        ) : (
          <ul className="lili-boards__list">
            {boards.map((board) => {
              const isCurrent = roomIdOf(board.link) === currentRoom;
              return (
                <li key={board.link} className={isCurrent ? "is-current" : ""}>
                  <div className="lili-boards__name">
                    {board.name}
                    {isCurrent && <span>открыта сейчас</span>}
                  </div>
                  <div className="lili-boards__actions">
                    <button
                      onClick={async () => {
                        if (await copy(board.link)) {
                          setCopied(board.link);
                        }
                      }}
                    >
                      {copied === board.link ? "Скопировано" : "Ссылка"}
                    </button>
                    {!isCurrent && (
                      <button
                        className="primary"
                        onClick={() => openBoard(board.link)}
                      >
                        Открыть
                      </button>
                    )}
                    <button
                      className="ghost"
                      onClick={() => remove(board)}
                      aria-label={`Убрать ${board.name}`}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="lili-boards__note">
          Список хранится в этом браузере. Сохрани ссылки и у себя в кабинете
          репетитора, чтобы не потерять их при смене компьютера.
        </p>
      </div>
    </div>
  );
};
