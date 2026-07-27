import { Terminal, Trash2, FileText, Copy, Check } from "lucide-react";
import { useState } from "react";

interface CodeOutputProps {
  output: string[];
  onClear: () => void;
  input: string;
  onInputChange: (value: any) => void;
}

export const CodeOutput = ({ output, onClear, input, onInputChange }: CodeOutputProps) => {
  const [copied, setCopied] = useState(false);

  const copyOutput = async () => {
    if (!output.length) return;
    await navigator.clipboard.writeText(output.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Input Section */}
      <div className="rounded-2xl border border-white/[.1] bg-[#111a2b]/85 p-4 shadow-xl shadow-black/15 backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-300/10"><FileText className="h-4 w-4 text-cyan-300" /></span>
          <div><h3 className="text-sm font-extrabold text-white">Program input</h3><p className="text-[11px] text-slate-500">Shared with everyone in the room</p></div>
        </div>
        <textarea
          value={input}
          onChange={(e) => onInputChange(e)}
          placeholder="Enter input for your code like...&#10;5&#10;10"
          className="h-32 w-full resize-none rounded-xl border border-white/[.08] bg-[#080e1b]/85 p-3 font-mono-app text-sm text-white placeholder:text-slate-600 focus:border-cyan-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/10"
        />
      </div>

      {/* Output Section */}
      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/[.1] bg-[#111a2b]/85 p-4 shadow-xl shadow-black/15 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-400/10"><Terminal className="h-4 w-4 text-emerald-300" /></span>
            <div><h3 className="text-sm font-extrabold text-white">Console output</h3><p className="text-[11px] text-slate-500">Results from your latest run</p></div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={copyOutput} disabled={!output.length} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/[.07] hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-35" title="Copy output">
              {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
            </button>
            <button onClick={onClear} className="group rounded-lg p-2 text-slate-400 transition hover:bg-rose-400/10 hover:text-rose-300" title="Clear output"><Trash2 className="h-4 w-4 transition-transform group-hover:scale-110" /></button>
          </div>
        </div>
        
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/[.07] bg-[#080e1b]/85 p-4">
          {output.length > 0 ? (
            <div className="space-y-1">
              {output.map((line, index) => (
                <pre key={index} className="font-mono-app text-sm whitespace-pre-wrap break-all text-emerald-300">
                  {line}
                </pre>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Terminal className="mx-auto mb-3 h-10 w-10 text-slate-600" />
              <p className="text-sm font-bold text-slate-400">Ready when you are</p>
              <p className="mt-1 text-xs text-slate-600">Run your code to see its output here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
