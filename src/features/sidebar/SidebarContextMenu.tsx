import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Edit3, Copy, FolderPlus, FilePlus, Users, FileDown, Trash2, ArrowRightLeft } from 'lucide-react';
import { Collection } from '../../types';
import { PersistenceService } from '../../services/PersistenceService';
import { CollectionExportService } from '../../services/CollectionExportService';
import { useStore } from '../../store/useStore';

interface ContextMenuState {
  x: number;
  y: number;
  type: 'collection' | 'folder' | 'request';
  id: string;
  name: string;
  collectionId?: string;
  parentId?: string;
}

interface SidebarContextMenuProps {
  contextMenu: ContextMenuState | null;
  collections: Collection[];
  activeWorkspaceId: string | null;
  profile: any;
  addToast: (toast: any) => void;
  fetchCollections: (workspaceId: string) => Promise<void>;
  setModalContext: (ctx: any) => void;
  setMovingRequest: (req: any) => void;
  setShareCollection: (col: any) => void;
  setIsShareModalOpen: (open: boolean) => void;
}

export const SidebarContextMenu: React.FC<SidebarContextMenuProps> = ({
  contextMenu,
  collections,
  activeWorkspaceId,
  profile,
  addToast,
  fetchCollections,
  setModalContext,
  setMovingRequest,
  setShareCollection,
  setIsShareModalOpen,
}) => {
  if (!contextMenu) return null;

  const handleDuplicateCollection = async () => {
    if (!profile?.id || !activeWorkspaceId) return;
    try {
      addToast({ type: 'info', message: 'Duplicating collection archetype...' });
      await PersistenceService.duplicateCollection(contextMenu.id, profile.id, activeWorkspaceId);
      await fetchCollections(activeWorkspaceId);
      addToast({ type: 'success', message: 'Collection duplicated successfully.' });
    } catch {
      addToast({ type: 'error', message: 'Duplication failed.' });
    }
  };

  const handleDuplicateFolder = async () => {
    if (!profile?.id || !activeWorkspaceId || !contextMenu.collectionId) return;
    try {
      addToast({ type: 'info', message: 'Duplicating folder branch...' });
      await PersistenceService.duplicateFolder(
        contextMenu.id,
        contextMenu.collectionId,
        profile.id,
        contextMenu.parentId,
        activeWorkspaceId
      );
      await fetchCollections(activeWorkspaceId);
      addToast({ type: 'success', message: 'Folder branch duplicated successfully.' });
    } catch {
      addToast({ type: 'error', message: 'Duplication failed.' });
    }
  };

  const handleDuplicateRequest = async () => {
    if (!activeWorkspaceId) return;
    try {
      addToast({ type: 'info', message: 'Duplicating request segment...' });
      const req = useStore.getState().collections
        .flatMap(c => [...(c.requests || []), ...(c.folders || []).flatMap(f => f.requests || [])])
        .find(r => r.id === contextMenu.id);
      if (req) {
        const duplicate = {
          ...req,
          id: undefined,
          name: `${req.name} (Copy)`,
          user_id: profile?.id
        } as any;
        delete duplicate.id;
        const created = await PersistenceService.createRequest(duplicate);
        await fetchCollections(activeWorkspaceId);
        useStore.getState().addTab(created);
        addToast({ type: 'success', message: 'Request cloned successfully.' });
      }
    } catch {
      addToast({ type: 'error', message: 'Duplication failed.' });
    }
  };

  const handleMoveRequestAction = () => {
    const req = useStore.getState().collections
      .flatMap(c => [...(c.requests || []), ...(c.folders || []).flatMap(f => f.requests || [])])
      .find(r => r.id === contextMenu.id);
    if (req) {
      setMovingRequest(req);
      addToast({ type: 'info', message: 'Choose destination collection or folder.' });
    }
  };

  const handleExportCollection = () => {
    const col = collections.find(c => c.id === contextMenu.id);
    if (col) {
      CollectionExportService.exportCollection(col);
      addToast({ type: 'success', message: 'Exporting collection binary...' });
    }
  };

  return (
    <AnimatePresence>
      {contextMenu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -5 }}
          transition={{ duration: 0.12 }}
          className="fixed w-52 bg-[#0F0F12]/95 border border-[#1D1D22] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] py-2 z-[9999] backdrop-blur-2xl overflow-hidden"
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 260),
            left: Math.min(contextMenu.x, window.innerWidth - 220)
          }}
        >
          <div className="px-4 py-1.5 mb-1 border-b border-white/[0.03]">
            <span className="text-[8px] font-black text-[#55555C] uppercase tracking-[0.2em] font-mono">Node actions // Gimay</span>
          </div>

          {contextMenu.type === 'collection' && (
            <>
              <button
                onClick={() => {
                  setModalContext({ type: 'collection', action: 'rename', id: contextMenu.id, initialValue: contextMenu.name });
                }}
                className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center justify-between group/opt transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Edit3 size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Rename Collection
                </div>
                <span className="text-[7px] text-[#33333C] font-mono">F2</span>
              </button>
              <button
                onClick={handleDuplicateCollection}
                className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center gap-2.5 group/opt transition-colors"
              >
                <Copy size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Duplicate Collection
              </button>
              <button
                onClick={() => {
                  setModalContext({ type: 'collection', action: 'create_folder', id: '', collectionId: contextMenu.id });
                }}
                className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center gap-2.5 group/opt transition-colors"
              >
                <FolderPlus size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Add Sub-Folder
              </button>
              <button
                onClick={() => {
                  setModalContext({ type: 'collection', action: 'create_request', id: '', collectionId: contextMenu.id });
                }}
                className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center gap-2.5 group/opt transition-colors"
              >
                <FilePlus size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Add Request
              </button>
              <div className="h-px bg-white/[0.03] my-1" />
              <button
                onClick={() => {
                  const col = collections.find(c => c.id === contextMenu.id);
                  if (col) {
                    setShareCollection(col);
                    setIsShareModalOpen(true);
                  }
                }}
                className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center gap-2.5 group/opt transition-colors"
              >
                <Users size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Protocol Share
              </button>
              <button
                onClick={handleExportCollection}
                className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center gap-2.5 group/opt transition-colors"
              >
                <FileDown size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Export Schema
              </button>
              <div className="h-px bg-white/[0.03] my-1" />
              <button
                onClick={() => {
                  setModalContext({ type: 'collection', action: 'delete', id: contextMenu.id, name: contextMenu.name });
                }}
                className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-red-500 hover:bg-red-500/10 hover:text-red-400 flex items-center gap-2.5 group/opt transition-colors"
              >
                <Trash2 size={11} className="text-red-900 group-hover/opt:text-red-500" /> Purge Collection
              </button>
            </>
          )}

          {contextMenu.type === 'folder' && (
            <>
              <button
                onClick={() => {
                  setModalContext({ type: 'folder', action: 'rename', id: contextMenu.id, initialValue: contextMenu.name });
                }}
                className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center justify-between group/opt transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Edit3 size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Rename Folder
                </div>
                <span className="text-[7px] text-[#33333C] font-mono">F2</span>
              </button>
              <button
                onClick={handleDuplicateFolder}
                className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center gap-2.5 group/opt transition-colors"
              >
                <Copy size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Duplicate Folder
              </button>
              <button
                onClick={() => {
                  setModalContext({ type: 'folder', action: 'create_folder', id: '', collectionId: contextMenu.collectionId, parentId: contextMenu.id });
                }}
                className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center gap-2.5 group/opt transition-colors"
              >
                <FolderPlus size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Add Nested Folder
              </button>
              <button
                onClick={() => {
                  setModalContext({ type: 'folder', action: 'create_request', id: '', collectionId: contextMenu.collectionId, parentId: contextMenu.id });
                }}
                className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center gap-2.5 group/opt transition-colors"
              >
                <FilePlus size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Add Request
              </button>
              <div className="h-px bg-white/[0.03] my-1" />
              <button
                onClick={() => {
                  setModalContext({ type: 'folder', action: 'delete', id: contextMenu.id, name: contextMenu.name });
                }}
                className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-red-500 hover:bg-red-500/10 hover:text-red-400 flex items-center gap-2.5 group/opt transition-colors"
              >
                <Trash2 size={11} className="text-red-900 group-hover/opt:text-red-500" /> Purge Folder
              </button>
            </>
          )}

          {contextMenu.type === 'request' && (
            <>
              <button
                onClick={() => {
                  setModalContext({ type: 'request', action: 'rename', id: contextMenu.id, initialValue: contextMenu.name });
                }}
                className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center justify-between group/opt transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Edit3 size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Rename Request
                </div>
                <span className="text-[7px] text-[#33333C] font-mono">F2</span>
              </button>
              <button
                onClick={handleDuplicateRequest}
                className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center gap-2.5 group/opt transition-colors"
              >
                <Copy size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Duplicate Request
              </button>
              <button
                onClick={handleMoveRequestAction}
                className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center gap-2.5 group/opt transition-colors"
              >
                <ArrowRightLeft size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Relocate Request
              </button>
              <div className="h-px bg-white/[0.03] my-1" />
              <button
                onClick={() => {
                  setModalContext({ type: 'request', action: 'delete', id: contextMenu.id, name: contextMenu.name });
                }}
                className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-red-500 hover:bg-red-500/10 hover:text-red-400 flex items-center gap-2.5 group/opt transition-colors"
              >
                <Trash2 size={11} className="text-red-900 group-hover/opt:text-red-500" /> Purge Request
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
