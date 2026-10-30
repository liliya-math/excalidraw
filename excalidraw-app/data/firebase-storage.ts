import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

let storage: ReturnType<typeof getStorage> | null = null;

export const loadStorage = () => {
  if (!storage) {
    const config = JSON.parse(import.meta.env.VITE_APP_FIREBASE_CONFIG || "{}");
    storage = getStorage(initializeApp(config));
  }
  return storage;
};
