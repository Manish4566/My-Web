
import React, { useEffect, useRef } from 'react';
import { AnalysisResult, LiveTranscription } from '../types';
import { Brain, Layout, ListChecks, ArrowRight, Mic, MicOff, Terminal } from 'lucide-react';

interface PanelLeftProps {
  isOpen: boolean;
  analysis: AnalysisResult | null;
  loading: boolean;
  liveTranscriptions?: LiveTranscription[];
  liveStatus?: string;
}

const PanelLeft: React.FC<PanelLeftProps> = ({ isOpen, analysis, loading, liveTranscriptions, liveStatus }) => {
  const hasVoice = analysis?.spokenIntent && analysis.spokenIntent.trim().length > 0;
  const transcriptionsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (liveTranscriptions && transcriptionsEndRef.current) {
      transcriptionsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveTranscriptions]);

  return (
    <div 
      className={`fixed top-0 left-0 h-full w-[380px] bg-[#0c0c0c] border-r border-white/5 z-40 transition-transform duration-500 ease-out transform ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } shadow-2xl overflow-y-auto pt-8 px-6 pb-12 custom-scrollbar`}
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <Brain className="w-6 h-6 text-blue-400" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">AI Audit & Voice</h2>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-6 bg-white/5 rounded w-3/4"></div>
          <div className="h-24 bg-white/5 rounded"></div>
          <div className="h-24 bg-white/5 rounded"></div>
        </div>
      ) : liveTranscriptions ? (
        /* Live Session View */
        <div className="space-y-6 animate-in fade-in duration-500">
           <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Live Transcript</span>
              <span className="text-[9px] text-white/30 uppercase font-bold italic tracking-tighter">{liveStatus}</span>
           </div>
           
           <div className="space-y-4 flex flex-col">
             {liveTranscriptions.map((t) => (
               <div key={t.id} className={`flex flex-col w-full ${t.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300 mb-2`}>
                 <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed border max-w-[85%] ${
                   t.role === 'user' 
                   ? 'bg-blue-500/10 border-blue-500/20 text-blue-50 rounded-tr-none' 
                   : 'bg-white/5 border-white/10 text-white/80 rounded-tl-none'
                 }`}>
                   {t.text}
                 </div>
                 <span className="text-[8px] text-white/20 uppercase font-black tracking-widest mt-1">
                   {t.role === 'user' ? 'User' : 'Architect'}
                 </span>
               </div>
             ))}
             {liveTranscriptions.length === 0 && (
               <div className="py-20 text-center opacity-20">
                 <Mic className="w-12 h-12 mx-auto mb-4 animate-pulse" />
                 <p className="text-xs uppercase tracking-widest font-black">Listening for voice input...</p>
               </div>
             )}
             <div ref={transcriptionsEndRef} className="h-4" />
           </div>
        </div>
      ) : analysis ? (
        <div className="space-y-8">
          <section className="animate-in fade-in slide-in-from-top-2 duration-700">
            <div className={`flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-widest ${hasVoice ? 'text-blue-400' : 'text-white/20'}`}>
              {hasVoice ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              {hasVoice ? 'Spoken Instruction' : 'No Voice Detected'}
            </div>
            <div className={`p-4 rounded-2xl border transition-colors ${hasVoice ? 'bg-blue-500/10 border-blue-500/30 text-white shadow-lg shadow-blue-500/5' : 'bg-white/5 border-white/10 text-white/20'}`}>
              <p className={`text-sm leading-relaxed ${hasVoice ? 'italic' : ''}`}>
                {hasVoice ? `"${analysis.spokenIntent}"` : "The source appears to be silent. Use the text box for instructions."}
              </p>
            </div>
          </section>

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
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3 text-white/50 text-xs font-bold uppercase tracking-widest">
              <ListChecks className="w-4 h-4" />
              UI Architecture
            </div>
            <div className="space-y-3">
              {analysis.elements?.map((el, idx) => (
                <div key={idx} className="p-3 bg-white/5 rounded-lg border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-blue-400 uppercase">{el.type}</span>
                    {el.canEdit && (
                      <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Editable</span>
                    )}
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed">{el.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3 text-white/50 text-xs font-bold uppercase tracking-widest">
              <ArrowRight className="w-4 h-4" />
              Audit Logic
            </div>
            <ul className="space-y-4">
              {analysis.reasoning?.map((step, idx) => (
                <li key={idx} className="flex gap-3">
                  <span className="text-blue-500/50 font-mono text-sm">0{idx + 1}</span>
                  <p className="text-sm text-white/60 leading-relaxed">{step}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : (
        <div className="h-[60vh] flex flex-col items-center justify-center text-center opacity-40">
           <Brain className="w-12 h-12 mb-4" />
           <p className="text-sm">Context Pending...</p>
        </div>
      )}
    </div>
  );
};

export default PanelLeft;
