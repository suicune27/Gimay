import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Folder, FolderOpen, GripVertical, Plus, FolderPlus, MoreVertical } from 'lucide-react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { cn } from '../../lib/utils';
import { Collection, RequestData } from '../../types';
import { FolderNode } from './FolderNode';
import { RequestNode } from './RequestNode';

interface CollectionNodeProps {
  collection: Collection;
  index: number;
  expandedNodes: Record<string, boolean>;
  toggleNodeExpanded: (id: string) => void;
  activeTabId: string | null;
  addTab: (res: any) => void;
  movingRequest: RequestData | null;
  handleMoveRequest: (colId: string, fId?: string) => void;
  setModalContext: (ctx: any) => void;
  setShareCollection: (col: any) => void;
  setIsShareModalOpen: (open: boolean) => void;
  setContextMenu: (menu: any) => void;
  canEdit: boolean;
}

export const CollectionNode: React.FC<CollectionNodeProps> = ({
  collection,
  index,
  expandedNodes,
  toggleNodeExpanded,
  activeTabId,
  addTab,
  movingRequest,
  handleMoveRequest,
  setModalContext,
  setShareCollection,
  setIsShareModalOpen,
  setContextMenu,
  canEdit
}) => {
  const isOpen = !!expandedNodes[collection.id];
  const isActive = activeTabId === collection.id;

  const handleContextMenuTrigger = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'collection',
      id: collection.id,
      name: collection.name
    });
  };

  const handleRowClick = (e: React.MouseEvent) => {
    if (movingRequest) {
      e.stopPropagation();
      handleMoveRequest(collection.id);
      return;
    }
    addTab(collection);
    toggleNodeExpanded(collection.id);
  };

  return (
    <Draggable draggableId={collection.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "select-none group/col transition-opacity",
            snapshot.isDragging && "opacity-40"
          )}
        >
          <div
            onClick={handleRowClick}
            onContextMenu={handleContextMenuTrigger}
            className={cn(
              "group flex items-center px-3.5 py-2 hover:bg-white/[0.02] cursor-pointer transition-all border-l-[3px] relative overflow-hidden h-9",
              isActive
                ? "bg-[#3ECF8E]/5 border-[#3ECF8E] text-white"
                : "border-transparent text-[#88888F] hover:text-white"
            )}
          >
            {isActive && (
              <div className="absolute inset-0 bg-[#3ECF8E]/[0.01] shadow-[inset_4px_0_15px_rgba(62,207,142,0.02)] pointer-events-none" />
            )}

            <div
              {...provided.dragHandleProps}
              className="mr-1 opacity-0 group-hover/col:opacity-100 transition-opacity flex items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={11} className="text-[#33333F]" />
            </div>

            <div
              className="p-1 -ml-1 hover:bg-white/5 rounded transition-colors relative z-10"
              onClick={(e) => {
                e.stopPropagation();
                toggleNodeExpanded(collection.id);
              }}
            >
              <motion.div
                animate={{ rotate: isOpen ? 90 : 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-center"
              >
                <ChevronRight size={12} className={isOpen ? "text-[#3ECF8E]" : "text-[#44444F]"} />
              </motion.div>
            </div>

            <div className="relative ml-1.5 mr-2 z-10">
              {isOpen ? (
                <FolderOpen size={13} className="text-[#3ECF8E]" />
              ) : (
                <Folder size={13} className="text-[#55555C]" />
              )}
            </div>

            <div className="flex flex-col flex-1 min-w-0 relative z-10">
              <span className="text-[10px] font-black uppercase tracking-[0.05em] truncate">
                {collection.name}
              </span>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover/col:opacity-100 transition-opacity relative z-10 scale-90">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setModalContext({ type: 'collection', action: 'create_folder', id: '', collectionId: collection.id });
                }}
                className="p-1 hover:text-[#3ECF8E] text-[#55555C] hover:bg-white/5 rounded"
                title="Add Folder"
              >
                <FolderPlus size={12} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setModalContext({ type: 'collection', action: 'create_request', id: '', collectionId: collection.id });
                }}
                className="p-1 hover:text-[#3ECF8E] text-[#55555C] hover:bg-white/5 rounded"
                title="Add Request"
              >
                <Plus size={13} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    type: 'collection',
                    id: collection.id,
                    name: collection.name
                  });
                }}
                className="p-1 hover:text-white text-[#55555C] hover:bg-white/5 rounded"
              >
                <MoreVertical size={12} />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-l border-[#1A1A22] ml-[23px] pl-1 py-0.5 space-y-0.5"
              >
                <Droppable droppableId={`${collection.id}:folders`} type="folder">
                  {(prov) => (
                    <div {...prov.droppableProps} ref={prov.innerRef} className="space-y-0.5">
                      {collection.folders?.map((folder, folderIdx) => (
                        <FolderNode
                          key={folder.id}
                          folder={folder}
                          index={folderIdx}
                          collectionId={collection.id}
                          expandedNodes={expandedNodes}
                          toggleNodeExpanded={toggleNodeExpanded}
                          activeTabId={activeTabId}
                          addTab={addTab}
                          movingRequest={movingRequest}
                          handleMoveRequest={handleMoveRequest}
                          setModalContext={setModalContext}
                          setContextMenu={setContextMenu}
                        />
                      ))}
                      {prov.placeholder}
                    </div>
                  )}
                </Droppable>

                <Droppable droppableId={`${collection.id}:requests:root`} type="request">
                  {(prov) => (
                    <div {...prov.droppableProps} ref={prov.innerRef} className="space-y-0.5">
                      {collection.requests?.filter(r => !r.folder_id).map((req, reqIdx) => (
                        <RequestNode
                          key={req.id}
                          request={req}
                          index={reqIdx}
                          activeTabId={activeTabId}
                          addTab={addTab}
                          setContextMenu={setContextMenu}
                        />
                      ))}
                      {prov.placeholder}
                    </div>
                  )}
                </Droppable>

                {(!collection.requests?.length && !collection.folders?.length) && (
                  <div className="px-5 py-2.5 text-[8px] font-black text-[#44444F] uppercase tracking-widest italic font-mono">
                    Empty Collection
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </Draggable>
  );
};
