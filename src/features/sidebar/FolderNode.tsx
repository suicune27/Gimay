import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Folder, FolderOpen, GripVertical, Plus, FolderPlus, MoreVertical } from 'lucide-react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { cn } from '../../lib/utils';
import { Folder as FolderType, RequestData } from '../../types';
import { RequestNode } from './RequestNode';

interface FolderNodeProps {
  folder: FolderType;
  index: number;
  collectionId: string;
  expandedNodes: Record<string, boolean>;
  toggleNodeExpanded: (id: string) => void;
  activeTabId: string | null;
  addTab: (res: any) => void;
  movingRequest: RequestData | null;
  handleMoveRequest: (colId: string, fId?: string) => void;
  setModalContext: (ctx: any) => void;
  setContextMenu: (menu: any) => void;
}

export const FolderNode: React.FC<FolderNodeProps> = ({
  folder,
  index,
  collectionId,
  expandedNodes,
  toggleNodeExpanded,
  activeTabId,
  addTab,
  movingRequest,
  handleMoveRequest,
  setModalContext,
  setContextMenu
}) => {
  const isOpen = !!expandedNodes[folder.id];

  const handleContextMenuTrigger = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'folder',
      id: folder.id,
      name: folder.name,
      collectionId,
      parentId: folder.parent_id
    });
  };

  const handleRowClick = (e: React.MouseEvent) => {
    if (movingRequest) {
      e.stopPropagation();
      handleMoveRequest(collectionId, folder.id);
      return;
    }
    toggleNodeExpanded(folder.id);
  };

  return (
    <Draggable draggableId={`${collectionId}:${folder.id}`} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "select-none group/folder relative transition-opacity",
            snapshot.isDragging && "opacity-40"
          )}
        >
          <div
            onClick={handleRowClick}
            onContextMenu={handleContextMenuTrigger}
            className="flex items-center px-2 py-1.5 hover:bg-white/[0.02] cursor-pointer transition-all border-l border-transparent hover:border-white/[0.03] text-[#77777F] hover:text-[#E0E0E6] h-8"
          >
            <div
              {...provided.dragHandleProps}
              className="mr-1 opacity-0 group-hover/folder:opacity-100 transition-opacity flex items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={10} className="text-[#33333F]" />
            </div>

            <div
              onClick={(e) => {
                e.stopPropagation();
                toggleNodeExpanded(folder.id);
              }}
              className="flex items-center"
            >
              <motion.div
                animate={{ rotate: isOpen ? 90 : 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-center"
              >
                <ChevronRight size={11} className={isOpen ? "text-[#3ECF8E]" : "text-[#44444F]"} />
              </motion.div>
            </div>

            {isOpen ? (
              <FolderOpen size={12} className="ml-1.5 mr-2 text-[#3ECF8E]" />
            ) : (
              <Folder size={12} className="ml-1.5 mr-2 text-[#55555C]" />
            )}

            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-wider truncate">
                {folder.name}
              </span>
            </div>

            <div className="flex items-center gap-0.5 opacity-0 group-hover/folder:opacity-100 transition-opacity scale-90">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setModalContext({ type: 'folder', action: 'create_folder', id: '', collectionId, parentId: folder.id });
                }}
                className="p-1 hover:text-[#3ECF8E] text-[#55555C] hover:bg-white/5 rounded"
                title="Add Sub-folder"
              >
                <FolderPlus size={11} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setModalContext({ type: 'folder', action: 'create_request', id: '', collectionId, parentId: folder.id });
                }}
                className="p-1 hover:text-[#3ECF8E] text-[#55555C] hover:bg-white/5 rounded"
                title="Add Request Inside"
              >
                <Plus size={12} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    type: 'folder',
                    id: folder.id,
                    name: folder.name,
                    collectionId,
                    parentId: folder.parent_id
                  });
                }}
                className="p-1 hover:text-white text-[#55555C] hover:bg-white/5 rounded"
              >
                <MoreVertical size={11} />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-l border-[#1A1A22] ml-[14px] pl-1.5 py-0.5 space-y-0.5"
              >
                {folder.folders?.map((sub, subIdx) => (
                  <FolderNode
                    key={sub.id}
                    folder={sub}
                    index={subIdx}
                    collectionId={collectionId}
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

                <Droppable droppableId={`${collectionId}:requests:${folder.id}`} type="request">
                  {(prov) => (
                    <div {...prov.droppableProps} ref={prov.innerRef} className="space-y-0.5">
                      {folder.requests?.map((req, reqIdx) => (
                        <RequestNode
                          key={req.id}
                          request={req}
                          index={reqIdx}
                          activeTabId={activeTabId}
                          addTab={addTab}
                          setContextMenu={setContextMenu}
                          folderId={folder.id}
                        />
                      ))}
                      {prov.placeholder}
                    </div>
                  )}
                </Droppable>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </Draggable>
  );
};
