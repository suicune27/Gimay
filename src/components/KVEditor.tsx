import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, Edit3 } from 'lucide-react';
import { KeyValue } from '../types';
import { cn } from '../lib/utils';
import { VariableInput } from './VariableInput';

interface KVEditorProps {
  items: KeyValue[];
  onChange: (items: KeyValue[]) => void;
  placeholderKey?: string;
  placeholderValue?: string;
  isVariableEditor?: boolean;
  allowMasking?: boolean;
  isFormData?: boolean;
}

export const KVEditor: React.FC<KVEditorProps> = ({ 
  items = [], 
  onChange, 
  placeholderKey = "KEY...",
  placeholderValue = "VALUE...",
  isVariableEditor = false,
  allowMasking = false,
  isFormData = false
}) => {
  const [isBulkEdit, setIsBulkEdit] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const handleItemChange = (id: string, updates: Partial<KeyValue>) => {
    const safeItems = items || [];
    const newItems = safeItems.map(item => {
      if (!item) return item;
      return item.id === id ? { ...item, ...updates } : item;
    });
    onChange(newItems);
  };

  const addItem = () => {
    const safeItems = (items || []).filter(Boolean);
    const newItem: KeyValue = {
      id: Math.random().toString(36).substr(2, 9),
      key: '',
      value: '',
      active: true
    };
    onChange([...safeItems, newItem]);
  };

  const removeItem = (id: string) => {
    const safeItems = (items || []).filter(Boolean);
    onChange(safeItems.filter(item => item.id !== id));
  };

  const startBulkEdit = () => {
    const safeItems = (items || []).filter(Boolean);
    const text = safeItems
      .filter(item => item && item.active)
      .map(item => `${item.key}: ${item.value}`)
      .join('\n');
    setBulkText(text);
    setIsBulkEdit(true);
  };

  const saveBulkEdit = () => {
    const lines = bulkText.split('\n');
    const newItems: KeyValue[] = lines
      .filter(line => line.trim() !== '')
      .map(line => {
        const trimmed = line.trim();
        const apiDogMatch = trimmed.match(/^([^,]+),([^,]+),(.*),(true|false),([^,]*),?$/i);

        let key = '';
        let value = '';
        let initialValue = '';
        let active = true;

        if (apiDogMatch) {
          key = apiDogMatch[1].trim();
          initialValue = apiDogMatch[3].trim();
          active = apiDogMatch[4].toLowerCase() === 'true';
          value = apiDogMatch[5] !== undefined ? apiDogMatch[5].trim() : initialValue;
        } else {
          // Try colon first, then equals
          let separatorIndex = trimmed.indexOf(':');
          if (separatorIndex === -1) separatorIndex = trimmed.indexOf('=');
          
          if (separatorIndex !== -1) {
            key = trimmed.substring(0, separatorIndex).trim();
            value = trimmed.substring(separatorIndex + 1).trim();
          } else {
            key = trimmed;
          }
        }

        return {
          id: Math.random().toString(36).substr(2, 9),
          key,
          value,
          initialValue,
          active
        };
      });
    
    onChange(newItems);
    setIsBulkEdit(false);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between border-b border-subtle pb-2 mb-2 px-1">
        <div className="flex flex-1">
          <div className="w-8" />
          <div className="flex-1 text-[10px] font-black text-dim uppercase tracking-widest px-2">Variable</div>
          {isVariableEditor && (
             <div className="flex-1 text-[10px] font-black text-dim uppercase tracking-widest px-2">Initial Value</div>
          )}
          <div className="flex-1 text-[10px] font-black text-dim uppercase tracking-widest px-2">{isVariableEditor ? 'Current Value' : 'Value'}</div>
          <div className="w-8" />
        </div>
        
        <button 
          onClick={isBulkEdit ? saveBulkEdit : startBulkEdit}
          className="flex items-center gap-1.5 px-2 py-1 text-[8px] font-black text-muted hover:text-brand transition-all uppercase tracking-widest bg-elevated border border-subtle rounded"
        >
          {isBulkEdit ? (
            <><CheckCircle2 size={10} /> Save Rows</>
          ) : (
            <><Edit3 size={10} /> Bulk Edit</>
          )}
        </button>
      </div>

      {isBulkEdit ? (
        <div className="px-1">
          <textarea 
            autoFocus
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="key: value&#10;key,default,initialValue,true,currentValue,"
            className="w-full h-48 bg-deep text-[11px] font-mono p-4 outline-none border border-subtle rounded-lg text-main placeholder:text-[var(--border-strong)] resize-none"
          />
          <p className="mt-2 text-[9px] text-dim font-medium italic">
            Enter key-value pairs (e.g. <code className="text-brand font-mono">key: value</code>) or paste APIdog format (e.g. <code className="text-brand font-mono">key,default,initial,true,current,</code>). Each pair on a new line.
          </p>
        </div>
      ) : (
        <>
          {(items || []).map((item) => (
            <div key={item.id} className="flex items-center gap-1 group">
              <button 
                onClick={() => handleItemChange(item.id, { active: !item.active })}
                className={cn(
                  "w-8 flex justify-center transition-colors",
                  item.active ? "text-brand" : "text-[var(--border-strong)] hover:text-dim"
                )}
              >
                {item.active ? <CheckCircle2 size={12} /> : <Circle size={12} />}
              </button>
              
              <div className="flex-1">
                <VariableInput 
                  value={item.key}
                  onChange={(val) => handleItemChange(item.id, { key: val })}
                  placeholder={placeholderKey}
                  className={!item.active ? "opacity-30" : ""}
                />
              </div>

              {isVariableEditor && (
                <div className="flex-1">
                  <VariableInput 
                    value={item.initialValue || ''}
                    onChange={(val) => handleItemChange(item.id, { initialValue: val })}
                    placeholder="INITIAL..."
                    className={!item.active ? "opacity-30" : ""}
                  />
                </div>
              )}

              <div className="flex-1">
                <VariableInput 
                  value={item.value}
                  onChange={(val) => handleItemChange(item.id, { value: val })}
                  placeholder={placeholderValue}
                  className={!item.active ? "opacity-30" : ""}
                />
              </div>

              <button 
                onClick={() => removeItem(item.id)}
                className="w-8 flex justify-center text-[var(--border-strong)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all px-2"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}

          <button 
            onClick={addItem}
            className="mt-2 flex items-center gap-2 px-2 py-1.5 text-[9px] font-black text-muted hover:text-brand transition-all uppercase tracking-widest"
          >
            <Plus size={12} /> Add Pair
          </button>
        </>
      )}
    </div>
  );
};
