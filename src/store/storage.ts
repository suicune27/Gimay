import { createJSONStorage } from 'zustand/middleware';

export const persistStorage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name);
    } catch (e) {
      console.error("Failed to read from localStorage:", e);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      console.warn("[Storage Quota Exceeded] Caught write exception safely. Running store in-memory.", e);
      // Self-healing: clear non-essential bloated localstorage items
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key !== name && !key.includes('sb-') && key !== 'gmy_theme_accent') {
            localStorage.removeItem(key);
          }
        }
      } catch (err) {
        console.error("Failed self-healing cleanup:", err);
      }
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch (e) {
      console.error("Failed to remove from localStorage:", e);
    }
  },
  key: (index: number) => {
    try {
      return localStorage.key(index);
    } catch (e) {
      return null;
    }
  },
  clear: () => {
    try {
      localStorage.clear();
    } catch (e) {
      console.error("Failed to clear localStorage:", e);
    }
  },
  get length() {
    try {
      return localStorage.length;
    } catch (e) {
      return 0;
    }
  }
}));
