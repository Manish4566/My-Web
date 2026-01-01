
import React, { useState, useEffect, useRef } from 'react';
import { AppStatus, AnalysisResult, FinalPrompt, ModalType, HistoryItem } from './types';
import PanelLeft from './components/PanelLeft';
import PanelRight from './components/PanelRight';
import UploadCircle from './components/UploadCircle';
import Modal from './components/Modals';
import { analyzeVideo, generateFinalPrompt } from './services/geminiService';
import { saveToHistory, getHistory } from './services/historyService';
import { auth, rtdb } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { Send, Zap, ShieldCheck, Clock, User, ArrowUpCircle, Gauge, LogOut, Cloud } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [prompt, setPrompt] = useState<FinalPrompt | null>(null);
  const [instructions, setInstructions] = useState('');
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [lastVideoBase64, setLastVideoBase64] = useState<string | null>(null);
  
  // Auth state
  const [user, setUser] = useState<{ email: string; uid: string; displayName?: string; photoURL?: string } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({ 
          email: firebaseUser.email || '', 
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || undefined,
          photoURL: firebaseUser.photoURL || undefined
        });

        // Sync user profile to Realtime Database immediately on login
        try {
          const userRef = ref(rtdb, `users/${firebaseUser.uid}/profile`);
          await set(userRef, {
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Anonymous',
            email: firebaseUser.email,
            lastActive: Date.now()
          });
        } catch (e) {
          console.error("Error syncing profile to RTDB:", e);
        }

        const history = await getHistory();
        setHistoryItems(history);
      } else {
        setUser(null);
        const history = await getHistory();
        setHistoryItems(history);
      }
    });

    return () => unsubscribe();
  }, []);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleVideoUpload = async (file: File) => {
    try {
      setStatus(AppStatus.ANALYZING);
      setIsLeftOpen(true);
      setIsRightOpen(false);
      
      const base64 = await fileToBase64(file);
      setLastVideoBase64(base64);
      const result = await analyzeVideo(base64);
      
      setAnalysis(result);
      setStatus(AppStatus.READY_FOR_PROMPT);
    } catch (error) {
      console.error("Analysis failed:", error);
      setStatus(AppStatus.IDLE);
      alert("Analysis failed. Please try a smaller video.");
    }
  };

  const handleGeneratePrompt = async () => {
    if (!analysis || !instructions.trim()) return;

    const currentInstructions = instructions;

    try {
      setStatus(AppStatus.GENERATING_PROMPT);
      setIsRightOpen(true);
      setInstructions('');
      
      const finalResult = await generateFinalPrompt(analysis, currentInstructions);
      
      setPrompt(finalResult);
      setStatus(AppStatus.COMPLETED);

      const newItem = await saveToHistory({
        instructions: currentInstructions,
        analysis,
        prompt: finalResult
      }, lastVideoBase64 || undefined);
      
      setHistoryItems(prev => [newItem, ...prev]);

    } catch (error) {
      console.error("Prompt generation failed:", error);
      setStatus(AppStatus.READY_FOR_PROMPT);
      setInstructions(currentInstructions);
      alert("Failed to generate prompt. Please try again.");
    }
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setAnalysis(item.analysis);
    setInstructions(item.instructions);
    setPrompt(item.prompt);
    setStatus(AppStatus.COMPLETED);
    setIsLeftOpen(true);
    setIsRightOpen(true);
    setActiveModal(null);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setAnalysis(null);
      setPrompt(null);
      setInstructions('');
      setStatus(AppStatus.IDLE);
      setIsLeftOpen(false);
      setIsRightOpen(false);
      setLastVideoBase64(null);
      setHistoryItems([]);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[80] flex items-center bg-white/5 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shadow-2xl">
        <button 
          onClick={() => setActiveModal('history')}
          className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-semibold hover:bg-white/10 transition-all text-white/70 hover:text-white"
        >
          <Clock className="w-4 h-4" />
          History
        </button>
        <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
        {user ? (
          <div className="flex items-center">
            <div className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-semibold text-blue-400">
              <Cloud className="w-3 h-3 animate-pulse text-blue-500 mr-1" />
              <span className="max-w-[120px] truncate">{user.displayName || user.email.split('@')[0]}</span>
            </div>
            <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
            <button 
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-500/10 transition-all text-white/50 hover:text-red-400"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setActiveModal('signup')}
            className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-semibold hover:bg-white/10 transition-all text-white/70 hover:text-white"
          >
            <User className="w-4 h-4" />
            Sign Up
          </button>
        )}
        <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
        <button 
          onClick={() => setActiveModal('upgrade')}
          className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold bg-white/10 hover:bg-white text-white hover:text-black transition-all"
        >
          <Zap className="w-4 h-4" />
          Upgrade
        </button>
      </div>

      <Modal 
        type={activeModal} 
        onClose={() => setActiveModal(null)} 
        history={historyItems}
        onSelectHistory={handleSelectHistory}
      />

      <PanelLeft 
        isOpen={isLeftOpen} 
        analysis={analysis} 
        loading={status === AppStatus.ANALYZING} 
      />
      
      <PanelRight 
        isOpen={isRightOpen} 
        prompt={prompt} 
        loading={status === AppStatus.GENERATING_PROMPT} 
      />

      <main className={`flex-grow flex flex-col items-center justify-center transition-all duration-500 ${
        isLeftOpen && isRightOpen ? 'px-[450px]' : isLeftOpen ? 'pl-[380px]' : isRightOpen ? 'pr-[420px]' : ''
      }`}>
        <div className="max-w-2xl w-full flex flex-col items-center gap-10 z-10 px-6 mt-12">
          
          <header className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-blue-400/60 font-mono text-[10px] uppercase tracking-[0.3em]">
              <Gauge className="w-3 h-3" />
              Turbo Processing Active
            </div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">
              PromptForge AI
            </h1>
            <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed uppercase tracking-[0.2em] font-medium">
              Architecting Non-Destructive Edit Prompts
            </p>
          </header>

          <UploadCircle 
            onFileSelect={handleVideoUpload} 
            isAnalyzing={status === AppStatus.ANALYZING}
            videoLoaded={!!analysis || status === AppStatus.ANALYZING}
          />

          <div className="w-full space-y-4">
             <div className="relative group">
               <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Explain what you want to edit and what should remain unchanged..."
                className="w-full h-40 bg-[#0c0c0c] border border-white/10 rounded-2xl p-5 text-sm focus:outline-none focus:border-blue-500/50 transition-all resize-none placeholder:text-white/20 leading-relaxed shadow-xl"
                disabled={status === AppStatus.ANALYZING || status === AppStatus.GENERATING_PROMPT || (status === AppStatus.IDLE && !analysis)}
              />
              <div className="absolute bottom-4 right-4 flex items-center gap-4">
                <button
                  onClick={handleGeneratePrompt}
                  disabled={!instructions.trim() || status === AppStatus.ANALYZING || status === AppStatus.GENERATING_PROMPT}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
                    !instructions.trim() || status === AppStatus.ANALYZING || status === AppStatus.GENERATING_PROMPT
                      ? 'bg-white/5 text-white/20 cursor-not-allowed' 
                      : 'bg-white text-black hover:bg-blue-400 hover:text-white shadow-lg'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  Generate Prompt
                </button>
              </div>
             </div>

             <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-4 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
                   <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Fast-Scan Engine</span>
                   </div>
                </div>
                <span className="text-[10px] text-white/20 uppercase tracking-widest font-mono">
                  v2.0.0 - Gemini Flash Optimized
                </span>
             </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-50">
          <button 
            onClick={() => setIsLeftOpen(!isLeftOpen)}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
              isLeftOpen ? 'bg-blue-500 text-white border-blue-400' : 'bg-white/5 text-white/40 border-white/10'
            }`}
          >
            Analysis {isLeftOpen ? 'Off' : 'On'}
          </button>
          <button 
            onClick={() => setIsRightOpen(!isRightOpen)}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
              isRightOpen ? 'bg-purple-500 text-white border-purple-400' : 'bg-white/5 text-white/40 border-white/10'
            }`}
          >
            Prompt {isRightOpen ? 'Off' : 'On'}
          </button>
      </div>
    </div>
  );
};

export default App;
