import React, { Suspense } from 'react';
import { cn } from '../../lib/utils';
import { Code2, Eye } from 'lucide-react';

const Editor = React.lazy(() => import('@monaco-editor/react'));

interface BodyTabProps {
  content: string;
  isHtml: boolean;
  theme: 'light' | 'dark';
  contentType?: string;
  previewMode: 'code' | 'preview';
  setPreviewMode: (mode: 'code' | 'preview') => void;
}

export const BodyTab: React.FC<BodyTabProps> = ({ content, isHtml, theme, contentType, previewMode, setPreviewMode }) => {
  if (isHtml) {
    return (
      <>
        <div className="h-8 px-3 border-b border-subtle bg-surface flex items-center gap-2 shrink-0">
          <div className="flex bg-deep rounded-lg p-0.5 border border-subtle">
            <button
              onClick={() => setPreviewMode('code')}
              className={cn(
                "px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                previewMode === 'code' ? "bg-[var(--brand)]/20 text-[var(--brand)]" : "text-dim hover:text-muted"
              )}
            >
              <Code2 size={10} />
              Code
            </button>
            <button
              onClick={() => setPreviewMode('preview')}
              className={cn(
                "px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                previewMode === 'preview' ? "bg-[var(--brand)]/20 text-[var(--brand)]" : "text-dim hover:text-muted"
              )}
            >
              <Eye size={10} />
              Preview
            </button>
          </div>
          <span className="text-[7px] font-mono text-dim ml-auto">HTML Response</span>
        </div>

        {previewMode === 'code' ? (
          <div className="flex-1 min-h-0">
            <Suspense fallback={
              <div className="absolute inset-0 flex items-center justify-center bg-surface text-dim text-xs font-mono">
                Drawing response body...
              </div>
            }>
              <Editor
                height="100%"
                language="html"
                value={content}
                theme={theme === 'light' ? 'vs' : 'vs-dark'}
                options={{
                  readOnly: true,
                  minimap: { enabled: true },
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono',
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 20 }
                }}
              />
            </Suspense>
          </div>
        ) : (
          <div className="flex-1 bg-white rounded-b-lg min-h-0">
            <iframe
              title="html-preview"
              srcDoc={content}
              className="w-full h-full border-none rounded-b-lg"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        )}
      </>
    );
  }

  // Default: Monaco editor for JSON/text
  return (
    <Suspense fallback={
      <div className="absolute inset-0 flex items-center justify-center bg-surface text-dim text-xs font-mono">
        Drawing response body...
      </div>
    }>
      <Editor
        height="100%"
        language={(contentType || '').includes('json') ? 'json' : 'text'}
        value={content}
        theme={theme === 'light' ? 'vs' : 'vs-dark'}
        options={{
          readOnly: true,
          minimap: { enabled: true },
          fontSize: 12,
          fontFamily: 'JetBrains Mono',
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 20 }
        }}
      />
    </Suspense>
  );
};
