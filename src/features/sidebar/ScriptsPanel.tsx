import React from 'react';
import { cn } from '../../lib/utils';

const scriptSnippets = [
  {
    title: 'Pre-request Context',
    items: [
      { name: 'Set Env Variable', code: 'gmy.environment.set("key", "value");' },
      { name: 'Get Env Variable', code: 'const token = gmy.environment.get("key");' },
      { name: 'Unset Env Variable', code: 'gmy.environment.unset("key");' },
      { name: 'Get Global Variable', code: 'const val = gmy.globals.get("key");' },
      { name: 'Send HTTP Request', code: 'gmy.request({\n  url: "https://httpbin.org/get",\n  method: "GET"\n}, (err, res) => {\n  console.log(res.json());\n});' }
    ]
  },
  {
    title: 'Post-Execution Validation',
    items: [
      { name: 'Status Code: 200 OK', code: 'gmy.test("Status is 200 OK", () => {\n  gmy.expect(res.status).to.equal(200);\n});' },
      { name: 'JSON Property Check', code: 'gmy.test("Response body exists", () => {\n  const json = res.json();\n  gmy.expect(json.id).to.exist;\n});' },
      { name: 'Header Content Check', code: 'gmy.test("Check Server Header", () => {\n  gmy.expect(res.headers["content-type"]).to.include("application/json");\n});' },
      { name: 'Latency Threshold', code: 'gmy.test("Response under 200ms", () => {\n  gmy.expect(res.responseTime).to.be.below(200);\n});' }
    ]
  }
];

interface ScriptsPanelProps {
  handleCopySnippet: (code: string) => void;
  handleAppendSnippet: (code: string) => void;
  onOpenScriptLab: () => void;
}

export const ScriptsPanel: React.FC<ScriptsPanelProps> = ({
  handleCopySnippet,
  handleAppendSnippet,
  onOpenScriptLab,
}) => {
  return (
    <div className="px-5 space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-[#1A1A1E]/30 pb-2 shrink-0">
        <span className="text-[9px] font-black text-[#55555C] uppercase tracking-widest font-mono">Logic Library</span>
        <div className="flex gap-1.5">
          <button
            onClick={onOpenScriptLab}
            className="text-[#3ECF8E] text-[8px] font-black uppercase border border-[#3ECF8E]/30 px-2 py-0.5 rounded-full hover:bg-[#3ECF8E]/10 transition-all tracking-wider"
          >
            OPEN LAB
          </button>
        </div>
      </div>

      <p className="text-[9px] text-[#55555C] font-semibold leading-relaxed uppercase tracking-tight font-mono">
        Copy and deploy pre-engineered automation scripts to execute transactions seamlessly.
      </p>

      <div className="space-y-4">
        {scriptSnippets.map((category, catIdx) => (
          <div key={catIdx} className="space-y-2">
            <div className="text-[8px] font-black text-amber-500/70 uppercase tracking-widest font-mono pl-1">{category.title}</div>
            <div className="space-y-1.5">
              {category.items.map((snippet, idx) => (
                <div
                  key={idx}
                  className="group/snip p-2 bg-[#0F0F12] border border-[#1A1A22] rounded-lg hover:border-[#3ECF8E]/30 hover:bg-[#121216] transition-all flex items-center justify-between relative overflow-hidden"
                >
                  <div className="min-w-0 pr-6">
                    <div className="text-[9px] font-bold text-[#E0E0E6] truncate font-mono uppercase tracking-wider">{snippet.name}</div>
                    <div className="text-[7px] text-[#55555C] font-mono truncate mt-0.5">{snippet.code}</div>
                  </div>

                  <div className="flex items-center gap-1.5 opacity-0 group-hover/snip:opacity-100 transition-opacity absolute right-2 bg-gradient-to-l from-[#121216] via-[#121216] to-transparent pl-4 py-1">
                    <button
                      onClick={() => handleCopySnippet(snippet.code)}
                      className="p-1 hover:text-[#3ECF8E] text-[#55555C] rounded hover:bg-white/5 transition-all text-[8px] font-black uppercase tracking-wider border border-[#1A1A22]"
                      title="Copy code"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => handleAppendSnippet(snippet.code)}
                      className="p-1 hover:text-[#3ECF8E] text-[#55555C] rounded hover:bg-white/5 transition-all text-[8px] font-black uppercase tracking-wider border border-[#1A1A22]"
                      title="Append directly to test code pane"
                    >
                      Append
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
