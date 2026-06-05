import React from 'react';
import { GripVertical, MoreVertical } from 'lucide-react';
import { Draggable } from '@hello-pangea/dnd';
import { cn } from '../../lib/utils';
import { RequestData } from '../../types';

interface RequestNodeProps {
  request: RequestData;
  index: number;
  activeTabId: string | null;
  addTab: (res: any) => void;
  setContextMenu: (menu: any) => void;
  folderId?: string;
}

const getMethodColor = (method: string): string => {
  switch (method) {
    case 'GET': return 'text-[#3ECF8E]';
    case 'POST': return 'text-amber-500';
    case 'PUT': return 'text-blue-500';
    case 'DELETE': return 'text-red-500';
    case 'PATCH': return 'text-purple-500';
    default: return 'text-[#AAAAAF]';
  }
};

export const RequestNode: React.FC<RequestNodeProps> = ({
  request,
  index,
  activeTabId,
  addTab,
  setContextMenu,
  folderId
}) => {
  const isActive = activeTabId === request.id;

  const handleContextMenuTrigger = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'request',
      id: request.id,
      name: request.name,
      collectionId: request.collection_id,
      parentId: folderId
    });
  };

  return (
    <Draggable draggableId={`${request.collection_id}:${request.id}${folderId ? `:${folderId}` : ''}`} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "select-none group/req transition-opacity relative",
            snapshot.isDragging && "opacity-40"
          )}
        >
          <div
            onClick={() => addTab(request)}
            onContextMenu={handleContextMenuTrigger}
            className={cn(
              "flex items-center px-3 py-1.5 hover:bg-white/[0.02] cursor-pointer transition-all border-l-[3px] h-7.5 relative items-stretch",
              isActive
                ? "bg-[#3ECF8E]/5 border-[#3ECF8E] text-white font-bold"
                : "border-transparent text-[#77777F] hover:text-[#E0E0E6]"
            )}
          >
            {isActive && (
              <div className="absolute inset-0 bg-[#3ECF8E]/[0.01] shadow-[inset_4px_0_12px_rgba(62,207,142,0.02)] pointer-events-none" />
            )}

            <div
              {...provided.dragHandleProps}
              className="flex items-center mr-1.5 opacity-0 group-hover/req:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={10} className="text-[#33333F]" />
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-0 relative z-10">
              <span className={cn(
                "text-[7px] font-black font-mono w-8 shrink-0 tracking-tighter uppercase",
                getMethodColor(request.method)
              )}>
                {request.method}
              </span>
              <span className="text-[9.5px] font-medium truncate tracking-wide">
                {request.name}
              </span>
            </div>

            <div className="flex items-center opacity-0 group-hover/req:opacity-100 transition-opacity scale-90 relative z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    type: 'request',
                    id: request.id,
                    name: request.name,
                    collectionId: request.collection_id,
                    parentId: folderId
                  });
                }}
                className="p-1 hover:text-white text-[#55555C] hover:bg-white/5 rounded"
              >
                <MoreVertical size={11} />
              </button>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};
