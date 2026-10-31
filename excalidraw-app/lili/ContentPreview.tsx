import { useEffect, useState } from "react";
import { getNonDeletedElements } from "@excalidraw/element";
import { exportToCanvas } from "@excalidraw/excalidraw";

import type { ContentTemplate } from "./content-templates";

export const ContentPreview = ({ template }: { template: ContentTemplate }) => {
  const [image, setImage] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setImage("");
    setFailed(false);
    void exportToCanvas({
      elements: getNonDeletedElements(template.elements),
      files: template.files,
      appState: {
        exportBackground: true,
        viewBackgroundColor: "#1c3a2e",
        exportWithDarkMode: false,
      },
      maxWidthOrHeight: 700,
    })
      .then((canvas) => {
        if (!cancelled) {
          setImage(canvas.toDataURL("image/png"));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [template]);
  return (
    <figure className="lili-content-preview">
      {image ? (
        <img src={image} alt={`Предпросмотр: ${template.name}`} />
      ) : (
        <p>
          {failed
            ? "Миниатюра недоступна. Содержимое материала сохранено."
            : "Готовлю предпросмотр…"}
        </p>
      )}
      <figcaption>{template.name}</figcaption>
    </figure>
  );
};
