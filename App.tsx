
import React, { useState, useEffect, useRef } from 'react';
import { AppStatus, AnalysisResult, FinalPrompt, ModalType, HistoryItem, UserProfile } from './types';
import PanelLeft from './components/PanelLeft';
import PanelRight from './components/PanelRight';
import UploadCircle from './components/UploadCircle';
import Modal from './components/Modals';
import { analyzeVideo, generateFinalPrompt } from './services/geminiService';
import { saveToHistory, getHistory } from './services/historyService';
import { auth, rtdb } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import { Zap, LogOut, Cloud, Key, ExternalLink, Mic, CheckCircle2 } from 'lucide-react';

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
  
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const [checkingKey, setCheckingKey] = useState(true);
  const [user, setUser] = useState<{ email: string; uid: string; displayName?: string } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const analysisRef = useRef<AnalysisResult | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
      setCheckingKey(false);
    };
    checkKey();

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({ email: firebaseUser.email || '', uid: firebaseUser.uid, displayName: firebaseUser.displayName || undefined });
        
        // Listen for profile changes (Pro Status)
        const profileRef = ref(rtdb, `users/${firebaseUser.uid}/profile`);
        onValue(profileRef, (snapshot) => {
          if (snapshot.exists()) {
            setUserProfile(snapshot.val() as UserProfile);
          }
        });

        const history = await getHistory();
        setHistoryItems(history);
      } else {
        setUser(null);
        setUserProfile(null);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const triggerPromptGeneration = async (currentAnalysis: AnalysisResult, manualInstructions: string) => {
    try {
      setStatus(AppStatus.GENERATING_PROMPT);
      setIsRightOpen(true);
      const finalResult = await generateFinalPrompt(currentAnalysis, manualInstructions);
      setPrompt(finalResult);
      setStatus(AppStatus.COMPLETED);

      const newItem = await saveToHistory({
        instructions: manualInstructions || currentAnalysis.spokenIntent || "Auto-detected from audio",
        analysis: currentAnalysis,
        prompt: finalResult
      }, lastVideoBase64 || undefined);
      setHistoryItems(prev => [newItem, ...prev]);
    } catch (error) {
      setStatus(AppStatus.READY_FOR_PROMPT);
      console.error(error);
    }
  };

  const handleVideoUpload = async (file: File) => {
    try {
      setStatus(AppStatus.ANALYZING);
      setIsLeftOpen(true);
      setPrompt(null);
      
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        setLastVideoBase64(base64);
        const result = await analyzeVideo(base64);
        setAnalysis(result);
        analysisRef.current = result;

        if (result.spokenIntent && result.spokenIntent.trim().length > 5) {
          setInstructions(result.spokenIntent);
          await triggerPromptGeneration(result, "");
        } else {
          setStatus(AppStatus.READY_FOR_PROMPT);
        }
      };
    } catch (error) {
      setStatus(AppStatus.IDLE);
      alert("API Error: Please check your connection.");
    }
  };

  if (checkingKey) return null;

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full glass-card p-10 rounded-[40px] border border-white/10 shadow-2xl space-y-8">
          <Key className="w-12 h-12 text-blue-400 mx-auto" />
          <h1 className="text-3xl font-bold">API Required</h1>
          <button onClick={handleSelectKey} className="w-full py-4 bg-white text-black rounded-2xl font-black text-lg">Connect API Key</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative overflow-hidden">
      {/* Top Header Bar */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[80] flex items-center bg-white/5 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shadow-2xl">
        <button onClick={() => setActiveModal('history')} className="px-6 py-2 text-sm font-semibold hover:bg-white/10 rounded-xl transition-all">History</button>
        <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
        {user ? (
          <div className="flex items-center">
            <div className="px-6 py-2 text-sm font-bold flex items-center gap-2 text-blue-400">
              <Cloud className="w-3 h-3" />
              {userProfile?.isPro && <CheckCircle2 className="w-3 h-3 text-green-400" />}
              {user.displayName || user.email.split('@')[0]}
            </div>
            <button onClick={() => signOut(auth)} className="p-2 hover:bg-red-500/10 rounded-xl text-white/50 hover:text-red-400 transition-colors"><LogOut className="w-4 h-4" /></button>
          </div>
        ) : (
          <button onClick={() => setActiveModal('signup')} className="px-6 py-2 text-sm font-semibold hover:bg-white/10 rounded-xl transition-all">Sign Up</button>
        )}
        <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
        
        {/* Dynamic Upgrade Button */}
        <button 
          onClick={() => !userProfile?.isPro && setActiveModal('upgrade')} 
          className={`px-6 py-2 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
            userProfile?.isPro 
            ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-default' 
            : 'bg-white/10 hover:bg-white text-white hover:text-black'
          }`}
        >
          {userProfile?.isPro ? (
            <><CheckCircle2 className="w-4 h-4" /> Successful!</>
          ) : (
            <><Zap className="w-4 h-4" /> Upgrade</>
          )}
        </button>
      </div>

      <Modal 
        type={activeModal} 
        onClose={() => setActiveModal(null)} 
        history={historyItems} 
        onSelectHistory={(item) => { 
          setAnalysis(item.analysis); 
          setPrompt(item.prompt); 
          setInstructions(item.instructions); 
          setStatus(AppStatus.COMPLETED); 
          setIsLeftOpen(true); 
          setIsRightOpen(true); 
          setActiveModal(null); 
        }} 
      />

      <PanelLeft isOpen={isLeftOpen} analysis={analysis} loading={status === AppStatus.ANALYZING} />
      <PanelRight isOpen={isRightOpen} prompt={prompt} loading={status === AppStatus.GENERATING_PROMPT} />

      <main className={`flex-grow flex flex-col items-center justify-center transition-all duration-500 ${isLeftOpen && isRightOpen ? 'px-[450px]' : isLeftOpen ? 'pl-[380px]' : isRightOpen ? 'pr-[420px]' : ''}`}>
        <div className="max-w-2xl w-full flex flex-col items-center gap-10 px-6 mt-12">
          <header className="text-center">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">PromptForge AI</h1>
            <p className="text-white/40 text-[10px] uppercase tracking-[0.4em] mt-3">Multimodal Edit Architect</p>
          </header>

          <UploadCircle onFileSelect={handleVideoUpload} isAnalyzing={status === AppStatus.ANALYZING} videoLoaded={!!analysis} />

          <div className="w-full bg-[#0c0c0c] border border-white/10 rounded-[32px] p-2 flex flex-col shadow-2xl group">
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={analysis ? "Describe changes or system will use voice audio..." : "Upload recording with voice instruction..."}
              className="w-full h-32 bg-transparent p-6 text-sm resize-none focus:outline-none placeholder:text-white/20"
              disabled={status === AppStatus.ANALYZING || !analysis}
            />
            <div className="flex items-center justify-between p-2 pl-6">
              <span className="text-[10px] uppercase tracking-widest text-white/20 font-bold flex items-center gap-2">
                {analysis?.spokenIntent ? <><Mic className="w-3 h-3 text-blue-400" /> Voice Extracted</> : `${instructions.length} characters`}
              </span>
              <button
                onClick={() => analysis && triggerPromptGeneration(analysis, instructions)}
                disabled={!instructions.trim() && !analysis?.spokenIntent || status === AppStatus.ANALYZING || status === AppStatus.GENERATING_PROMPT}
                className="px-8 py-3 bg-white text-black rounded-2xl font-bold hover:bg-blue-400 hover:text-white disabled:opacity-20 transition-all flex items-center gap-3"
              >
                {status === AppStatus.GENERATING_PROMPT ? (
                   <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Forging...</span>
                ) : (
                  <><Zap className="w-4 h-4" /> Generate Prompt</>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Control Pills */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-50">
          <button onClick={() => setIsLeftOpen(!isLeftOpen)} className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase transition-all border ${isLeftOpen ? 'bg-blue-500 border-blue-400' : 'bg-white/5 border-white/10 text-white/40'}`}>Audit View</button>
          <button onClick={() => setIsRightOpen(!isRightOpen)} className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase transition-all border ${isRightOpen ? 'bg-purple-500 border-purple-400' : 'bg-white/5 border-white/10 text-white/40'}`}>Prompt View</button>
      </div>
    </div>
  );
};

export default App;
