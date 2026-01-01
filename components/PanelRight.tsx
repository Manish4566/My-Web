
import React, { useState } from 'react';
import { FinalPrompt } from '../types';
import { Clipboard, Check, Sparkles, Terminal } from 'lucide-react';

interface PanelRightProps {
  isOpen: boolean;
  prompt: FinalPrompt | null;
  loading: boolean;
}

const PanelRight: React.FC<PanelRightProps> = ({ isOpen, prompt, loading }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (prompt) {
      navigator.clipboard.writeText(prompt.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div 
      className={`fixed top-0 right-0 h-full w-[420px] bg-[#0c0c0c] border-l border-white/5 z-40 transition-transform duration-500 ease-out transform ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } shadow-2xl overflow-y-auto pt-8 px-8 pb-12`}
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-purple-500/10 rounded-lg">
          <Sparkles className="w-6 h-6 text-purple-400" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Final Prompt Generator</h2>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-40 bg-white/5 rounded"></div>
          <div className="h-12 bg-white/5 rounded"></div>
        </div>
      ) : prompt ? (
        <div className="flex flex-col h-[calc(100%-80px)]">
          <div className="mb-4 flex items-center gap-2 text-white/50 text-xs font-bold uppercase tracking-widest">
            <Terminal className="w-4 h-4" />
            Optimized Edit Instructions
          </div>
          
          <div className="flex-grow p-5 bg-[#141414] border border-white/10 rounded-xl font-mono text-sm leading-relaxed text-white/80 overflow-y-auto relative group">
             {prompt.content}
          </div>

          <button
            onClick={handleCopy}
            className={`mt-6 w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold transition-all duration-300 ${
              copied 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-white text-black hover:bg-gray-200 shadow-lg shadow-white/5'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-5 h-5" />
                Copied to Clipboard
              </>
            ) : (
              <>
                <Clipboard className="w-5 h-5" />
                Copy Prompt
              </>
            )}
          </button>

          <p className="mt-4 text-center text-xs text-white/30 px-4">
            Copy and paste this into Google AI Studio or your favorite developer environment.
          </p>
        </div>
      ) : (
        <div className="h-[60vh] flex flex-col items-center justify-center text-center opacity-40">
           <Terminal className="w-12 h-12 mb-4" />
           <p className="text-sm">Analysis pending</p>
        </div>
      )}
    </div>
  );
};

export default PanelRight;
