// Self-healing recovery for origin-wide local storage exhaustion
export function performStorageCleanup(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    const storage = window.localStorage;
    let totalSize = 0;
    const keysToRemove: string[] = [];
    const omniStorageKey = 'omni-node-storage';

    // First, try to clean up omni-node-storage if it has responses
    const existing = storage.getItem(omniStorageKey);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed && parsed.state && parsed.state.openTabs) {
        let modified = false;
        parsed.state.openTabs = (parsed.state.openTabs || []).map((tab: any) => {
          if (tab && typeof tab === 'object' && 'response' in tab && tab.response !== null) {
            modified = true;
            return { ...tab, response: null };
          }
          return tab;
        });
        if (modified || existing.length > 100000) {
          storage.setItem(omniStorageKey, JSON.stringify(parsed));
        }
      }
    }

    // Inspect all keys to calculate total size and identify bloated keys
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key) {
        const val = storage.getItem(key) || '';
        const size = val.length * 2;
        totalSize += size;

        // Mark bloated non-critical keys for removal
        if (size > 300 * 1024 && key !== omniStorageKey && !key.includes('sb-') && key !== 'gmy_theme_accent') {
          keysToRemove.push(key);
        }
      }
    }

    // Remove bloated non-critical keys
    keysToRemove.forEach(k => {
      console.warn(`[Storage Clean] Removing bloated non-essential key: ${k}`);
      storage.removeItem(k);
    });

    // If local storage is still critically full (>4MB), wipe all other keys except supabase auth
    if (totalSize > 4 * 1024 * 1024) {
      console.warn("[Storage Clean] Local storage critically full. Performing full recovery.");
      const allKeys = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key !== omniStorageKey && !key.includes('sb-') && key !== 'gmy_theme_accent') {
          allKeys.push(key);
        }
      }
      allKeys.forEach(k => storage.removeItem(k));
    }
  } catch (e) {
    console.error("Failed to clean localStorage:", e);
  }
}
