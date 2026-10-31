import { useEffect, useRef } from "react";
export const MaterialDuplicateDialog = ({
  title,
  busy,
  onReuse,
  onCopy,
  onCancel,
}: {
  title: string;
  busy: boolean;
  onReuse: () => void;
  onCopy: () => void;
  onCancel: () => void;
}) => {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="lili-material-choice"
      aria-labelledby="lili-material-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) {
          onCancel();
        }
      }}
    >
      <h3 id="lili-material-title">Материал уже на доске</h3>
      <p>{title}</p>
      <p>Можно перейти к существующему заданию или добавить отдельную копию.</p>
      <div>
        <button disabled={busy} onClick={onReuse}>
          Перейти к заданию
        </button>
        <button disabled={busy} onClick={onCopy}>
          Добавить копию
        </button>
        <button disabled={busy} onClick={onCancel}>
          Отмена
        </button>
      </div>
    </dialog>
  );
};
