import { newElementWith } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

// A convenience lock in the regular shared scene, not a security boundary.
type Pin = { owner: string; snapshot: ExcalidrawElement };
let roomId = "";
let owner: string | null = null;
const pins = new Map<string, Pin>();

export const initClientProtection = (id: string) => {
  if (roomId !== id) {
    roomId = id;
    owner = null;
    pins.clear();
  }
};
export const setClientOwner = (value: string | null) => {
  owner = value;
};
const readPin = (element: ExcalidrawElement): Pin | null => {
  const pin = element.customData?.liliPin as Pin | undefined;
  return pin &&
    typeof pin.owner === "string" &&
    /^[a-f0-9]{64}$/.test(pin.owner) &&
    pin.snapshot?.id === element.id &&
    pin.snapshot.type === element.type &&
    Number.isFinite(pin.snapshot.version) &&
    !pin.snapshot.customData?.liliPin
    ? pin
    : null;
};
export const clientPinnedIds = () => new Set(pins.keys());
export const clientIsStudent = () =>
  [...pins.values()].some((pin) => pin.owner !== owner);
export const canUnpin = (element: ExcalidrawElement) =>
  readPin(element)?.owner === owner && owner !== null;

const withoutPin = (element: ExcalidrawElement) => {
  const customData: Record<string, unknown> = { ...element.customData };
  delete customData.liliPin;
  return { ...element, customData };
};

export const pinElements = (
  elements: readonly ExcalidrawElement[],
  selected: Readonly<Record<string, boolean>>,
) => {
  if (!owner) {
    throw new Error("Сначала включи закрепление в этом браузере.");
  }
  const ids = new Set(elements.filter((e) => selected[e.id]).map((e) => e.id));
  if (!ids.size) {
    throw new Error("Сначала выдели задание или рисунок на доске.");
  }
  // Keep frames, groups, containers and their bound text together.
  let changed = true;
  while (changed) {
    const groups = new Set(
      elements.filter((e) => ids.has(e.id)).flatMap((e) => e.groupIds),
    );
    changed = false;
    for (const e of elements) {
      if (
        !ids.has(e.id) &&
        ((e.frameId && ids.has(e.frameId)) ||
          ("containerId" in e && e.containerId && ids.has(e.containerId)) ||
          e.groupIds.some((id) => groups.has(id)) ||
          elements.some(
            (other) =>
              ids.has(other.id) &&
              "containerId" in other &&
              other.containerId === e.id,
          ))
      ) {
        ids.add(e.id);
        changed = true;
      }
    }
  }
  return elements.map((element) => {
    if (!ids.has(element.id) || element.isDeleted) {
      return element;
    }
    const existing = readPin(element);
    if (existing && existing.owner !== owner) {
      throw new Error("Это задание закреплено в другом браузере учителя.");
    }
    const snapshot = { ...withoutPin(element), locked: true };
    const pin = { owner: owner!, snapshot };
    pins.set(element.id, pin);
    return newElementWith(element, {
      locked: true,
      customData: { ...snapshot.customData, liliPin: pin },
    });
  });
};

export const unpinElements = (
  elements: readonly ExcalidrawElement[],
  ids: ReadonlySet<string>,
) =>
  elements.map((element) => {
    if (!ids.has(element.id) || !canUnpin(element)) {
      return element;
    }
    pins.delete(element.id);
    return newElementWith(element, {
      locked: false,
      customData: withoutPin(element).customData,
    });
  });

// Called only for incoming shared scenes: teacher unpin actions must propagate.
export const receiveClientProtection = (
  elements: readonly ExcalidrawElement[],
) => {
  for (const element of elements) {
    const pin = readPin(element);
    if (pin && !element.isDeleted) {
      pins.set(element.id, pin);
    } else if (!pin) {
      pins.delete(element.id);
    }
  }
};

export const enforceClientProtection = <T extends ExcalidrawElement>(
  elements: readonly T[],
): readonly T[] => {
  for (const element of elements) {
    const pin = readPin(element);
    if (pin && !pins.has(element.id)) {
      pins.set(element.id, pin);
    }
  }
  if (!pins.size) {
    return elements;
  }
  const map = new Map(elements.map((element) => [element.id, element]));
  let changed = false;
  for (const [id, pin] of pins) {
    if (pin.owner === owner) {
      continue;
    }
    const current = map.get(id);
    const expected: ExcalidrawElement = {
      ...pin.snapshot,
      locked: true,
      isDeleted: false,
      customData: { ...pin.snapshot.customData, liliPin: pin },
    };
    const differs =
      !current ||
      Object.keys(expected).some(
        (key) =>
          !["version", "versionNonce", "updated", "index", "status"].includes(
            key,
          ) &&
          JSON.stringify(current[key as keyof T]) !==
            JSON.stringify(expected[key as keyof typeof expected]),
      );
    if (differs) {
      const base: ExcalidrawElement = {
        ...expected,
        index: current?.index || expected.index,
        version: Math.max(expected.version, current?.version || 0),
      };
      map.set(id, newElementWith(base, {}, true) as T);
      changed = true;
    }
  }
  return changed ? [...map.values()] : elements;
};
