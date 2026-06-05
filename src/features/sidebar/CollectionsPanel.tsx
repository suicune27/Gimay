import React from 'react';
import { Plus, FileUp, ChevronsLeft, RefreshCw, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { cn } from '../../lib/utils';
import { Collection, RequestData } from '../../types';
import { CollectionNode } from './CollectionNode';

interface CollectionsPanelProps {
  filteredCollections: Collection[];
  expandedNodes: Record<string, boolean>;
  toggleNodeExpanded: (id: string) => void;
  activeTabId: string | null;
  addTab: (res: any) => void;
  movingRequest: RequestData | null;
  setMovingRequest: (req: RequestData | null) => void;
  handleMoveRequest: (colId: string, fId?: string) => void;
  setModalContext: (ctx: any) => void;
  setShareCollection: (col: any) => void;
  setIsShareModalOpen: (open: boolean) => void;
  setContextMenu: (menu: any) => void;
  canPerformAction: (item: any, action: string) => boolean;
  onNewCollection: () => void;
  onImport: () => void;
  onCollapseAll: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onDragEnd: (result: any) => void;
}

export const CollectionsPanel: React.FC<CollectionsPanelProps> = ({
  filteredCollections,
  expandedNodes,
  toggleNodeExpanded,
  activeTabId,
  addTab,
  movingRequest,
  setMovingRequest,
  handleMoveRequest,
  setModalContext,
  setShareCollection,
  setIsShareModalOpen,
  setContextMenu,
  canPerformAction,
  onNewCollection,
  onImport,
  onCollapseAll,
  onRefresh,
  isRefreshing,
  onDragEnd
}) => {
  return (
    <div className="px-1 flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-[#1A1A1E]/30 bg-[#070708]/10 mb-2 shrink-0">
        <span className="text-[8px] font-black text-[#55555C] uppercase tracking-[0.2em] font-mono">Collections</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onNewCollection}
            className="p-1 hover:text-[#3ECF8E] text-[#55555C] transition-colors"
            title="New Collection"
          >
            <Plus size={13} />
          </button>
          <button
            onClick={onImport}
            className="p-1 hover:text-[#3ECF8E] text-[#55555C] transition-colors"
            title="Import Collection Schema"
          >
            <FileUp size={13} />
          </button>
          <button
            onClick={onCollapseAll}
            className="p-1 hover:text-red-400 text-[#55555C] transition-colors"
            title="Collapse All Tree Nodes"
          >
            <ChevronsLeft size={13} />
          </button>
          <button
            onClick={onRefresh}
            className="p-1 hover:text-[#3ECF8E] text-[#55555C] transition-colors"
            title="Synchronize Local Cache"
          >
            <RefreshCw size={12} className={cn(isRefreshing && "animate-spin text-[#3ECF8E]")} />
          </button>
        </div>
      </div>

      {movingRequest && (
        <div className="mx-3 mb-3 p-2 bg-[#3ECF8E]/5 border border-[#3ECF8E]/20 rounded-xl text-[9px] uppercase tracking-wide flex flex-col gap-1.5 shrink-0 animate-in fade-in duration-200">
          <div className="font-black text-[#3ECF8E] flex items-center justify-between">
            <span>Select Relocation Target</span>
            <button onClick={() => setMovingRequest(null)} className="text-red-500 font-bold">X</button>
          </div>
          <div className="text-[#88888F] font-mono">Moving: {movingRequest.name}</div>
          <div className="text-[7px] text-[#55555C]">Click on any collection or folder to deploy here.</div>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="collections-root" type="collection">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1">
              {filteredCollections.map((col, idx) => (
                <CollectionNode
                  key={col.id}
                  collection={col}
                  index={idx}
                  expandedNodes={expandedNodes}
                  toggleNodeExpanded={toggleNodeExpanded}
                  activeTabId={activeTabId}
                  addTab={addTab}
                  movingRequest={movingRequest}
                  handleMoveRequest={handleMoveRequest}
                  setModalContext={setModalContext}
                  setShareCollection={setShareCollection}
                  setIsShareModalOpen={setIsShareModalOpen}
                  setContextMenu={setContextMenu}
                  canEdit={canPerformAction(col, 'edit')}
                />
              ))}
              {provided.placeholder}
              {filteredCollections.length === 0 && (
                <div className="text-center py-16 px-4">
                  <Database size={24} className="mx-auto text-[#1D1D22] mb-3" />
                  <p className="text-[9px] font-black text-[#44444F] uppercase tracking-widest leading-relaxed">No collections found</p>
                  <button
                    onClick={onNewCollection}
                    className="mt-3 px-3 py-1.5 bg-[#3ECF8E]/10 border border-[#3ECF8E]/30 text-[9px] text-[#3ECF8E] font-black uppercase tracking-widest rounded hover:bg-[#3ECF8E]/20 transition-all"
                  >
                    New Collection
                  </button>
                </div>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};
