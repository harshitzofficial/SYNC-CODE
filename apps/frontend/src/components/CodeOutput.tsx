import { Terminal, Trash2, FileText } from "lucide-react";

interface CodeOutputProps {
  output: string[];
  onClear: () => void;
  input: string;
  onInputChange: (value: any) => void;
}

export const CodeOutput = ({ output, onClear, input, onInputChange }: CodeOutputProps) => {
  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Input Section */}
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-green-400" />
          <h3 className="text-lg font-semibold text-white">Input</h3>
        </div>
        <textarea
          value={input}
          onChange={(e) => onInputChange(e)}
          placeholder="Enter input for your code like...&#10;5&#10;10"
          className="w-full h-32 bg-gray-800/50 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Output Section */}
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4 shadow-xl flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-green-400" />
            <h3 className="text-lg font-semibold text-white">Output</h3>
          </div>
          <button
            onClick={onClear}
            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-all duration-200 group"
            title="Clear output"
          >
            <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </button>
        </div>
        
        <div className="flex-1 bg-gray-900/50 border border-gray-700 rounded-lg p-4 overflow-y-auto custom-scrollbar min-h-0">
          {output.length > 0 ? (
            <div className="space-y-1">
              {output.map((line, index) => (
                <pre key={index} className="text-green-400 text-sm whitespace-pre-wrap break-all font-mono">
                  {line}
                </pre>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Terminal className="w-12 h-12 text-gray-500 mx-auto mb-2" />
              <p className="text-gray-400">No output yet</p>
              <p className="text-gray-500 text-sm">Submit your code to see results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};