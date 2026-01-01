
import React from 'react';
import { AnalysisResult } from '../types';
import { Brain, Layout, ListChecks, ArrowRight } from 'lucide-react';

interface PanelLeftProps {
  isOpen: boolean;
  analysis: AnalysisResult | null;
  loading: boolean;
}

const PanelLeft: React.FC<PanelLeftProps> = ({ isOpen, analysis, loading }) => {
  return (
    <div 
      className={`fixed top-0 left-0 h-full w-[380px] bg-[#0c0c0c] border-r border-white/5 z-40 transition-transform duration-500 ease-out transform ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } shadow-2xl overflow-y-auto pt-8 px-6 pb-12`}
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <Brain className="w-6 h-6 text-blue-400" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">AI Thinking / Analysis</h2>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-6 bg-white/5 rounded w-3/4"></div>
          <div className="h-24 bg-white/5 rounded"></div>
          <div className="h-24 bg-white/5 rounded"></div>
        </div>
      ) : analysis ? (
        <div className="space-y-8">
          <section>
            <div className="flex items-center gap-2 mb-3 text-white/50 text-xs font-bold uppercase tracking-widest">
              <Layout className="w-4 h-4" />
              Detected Pages
            </div>
            <div className="flex flex-wrap gap-2">
              {analysis.pages?.map((page, idx) => (
                <span key={idx} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-sm text-white/80">
                  {page}
                </span>
              ))}
              {(!analysis.pages || analysis.pages.length === 0) && (
                <span className="text-xs text-white/30 italic">No pages detected</span>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3 text-white/50 text-xs font-bold uppercase tracking-widest">
              <ListChecks className="w-4 h-4" />
              UI Elements & Logic
            </div>
            <div className="space-y-3">
              {analysis.elements?.map((el, idx) => (
                <div key={idx} className="p-3 bg-white/5 rounded-lg border border-white/5 hover:border-blue-500/30 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-blue-400 uppercase">{el.type}</span>
                    {el.canEdit && (
                      <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Editable</span>
                    )}
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed">{el.description}</p>
                </div>
              ))}
              {(!analysis.elements || analysis.elements.length === 0) && (
                <div className="text-xs text-white/30 italic">No UI elements identified</div>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3 text-white/50 text-xs font-bold uppercase tracking-widest">
              <ArrowRight className="w-4 h-4" />
              Step-by-Step Reasoning
            </div>
            <ul className="space-y-4">
              {analysis.reasoning?.map((step, idx) => (
                <li key={idx} className="flex gap-3">
                  <span className="text-blue-500/50 font-mono text-sm">0{idx + 1}</span>
                  <p className="text-sm text-white/60 leading-relaxed">{step}</p>
                </li>
              ))}
              {(!analysis.reasoning || analysis.reasoning.length === 0) && (
                <li className="text-xs text-white/30 italic">No reasoning provided</li>
              )}
            </ul>
          </section>
        </div>
      ) : (
        <div className="h-[60vh] flex flex-col items-center justify-center text-center opacity-40">
           <Brain className="w-12 h-12 mb-4" />
           <p className="text-sm">Upload a video to start analysis</p>
        </div>
      )}
    </div>
  );
};

export default PanelLeft;
