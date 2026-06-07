import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Script, ScriptFolder, ScriptTab, ScriptLog } from '../types';

interface ScriptState {
  scripts: Script[];
  folders: ScriptFolder[];
  openTabs: ScriptTab[];
  activeTabId: string | null;
  logs: ScriptLog[];
  isConsoleOpen: boolean;
  
  setScripts: (scripts: Script[]) => void;
  setFolders: (folders: ScriptFolder[]) => void;
  setOpenTabs: (tabs: ScriptTab[]) => void;
  setActiveTabId: (id: string | null) => void;
  addLog: (log: Omit<ScriptLog, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  setConsoleOpen: (open: boolean) => void;
  
  updateScript: (id: string, updates: Partial<Script>) => void;
  addScript: (script: Script) => void;
  deleteScript: (id: string) => void;
  
  addTab: (scriptId: string) => void;
  closeTab: (tabId: string) => void;
  setTabDirty: (tabId: string, isDirty: boolean) => void;
}

export const useScriptStore = create<ScriptState>()(
  persist(
    (set) => ({
      scripts: [],
      folders: [],
      openTabs: [],
      activeTabId: null,
      logs: [],
      isConsoleOpen: false,

      setScripts: (scripts) => set({ scripts }),
      setFolders: (folders) => set({ folders }),
      setOpenTabs: (openTabs) => set({ openTabs }),
      setActiveTabId: (activeTabId) => set({ activeTabId }),
      
      addLog: (log) => set((state) => ({
        logs: [
          ...state.logs,
          { ...log, id: Math.random().toString(36).substr(2, 9), timestamp: Date.now() }
        ].slice(-200) // Keep last 200 logs
      })),
      
      clearLogs: () => set({ logs: [] }),
      setConsoleOpen: (isConsoleOpen) => set({ isConsoleOpen }),

      updateScript: (id, updates) => set((state) => ({
        scripts: state.scripts.map((s) => (s.id === id ? { ...s, ...updates, updated_at: new Date().toISOString() } : s))
      })),

      addScript: (script) => set((state) => ({
        scripts: [script, ...state.scripts]
      })),

      deleteScript: (id) => set((state) => ({
        scripts: state.scripts.filter((s) => s.id !== id),
        openTabs: state.openTabs.filter((t) => t.scriptId !== id),
        activeTabId: state.activeTabId === state.openTabs.find(t => t.scriptId === id)?.id ? null : state.activeTabId
      })),

      addTab: (scriptId) => set((state) => {
        const existingTab = state.openTabs.find((t) => t.scriptId === scriptId);
        if (existingTab) return { activeTabId: existingTab.id };
        
        const newTabId = Math.random().toString(36).substr(2, 9);
        const newTab: ScriptTab = { id: newTabId, scriptId, isDirty: false };
        
        return {
          openTabs: [...state.openTabs, newTab],
          activeTabId: newTabId
        };
      }),

      closeTab: (tabId) => set((state) => {
        const newTabs = state.openTabs.filter((t) => t.id !== tabId);
        let newActiveId = state.activeTabId;
        
        if (state.activeTabId === tabId) {
          newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
        }
        
        return {
          openTabs: newTabs,
          activeTabId: newActiveId
        };
      }),

      setTabDirty: (tabId, isDirty) => set((state) => ({
        openTabs: state.openTabs.map((t) => (t.id === tabId ? { ...t, isDirty } : t))
      }))
    }),
    {
      name: 'gimay-scripts-storage',
      partialize: (state) => ({
        openTabs: state.openTabs,
        activeTabId: state.activeTabId,
        isConsoleOpen: state.isConsoleOpen,
        // Desktop local persistence - scripts & folders
        scripts: state.scripts || [],
        folders: state.folders || []
      })
    }
  )
);
