
import React, { useState, useEffect, useRef } from 'react';
import { AppStatus, AnalysisResult, FinalPrompt, ModalType, HistoryItem, UserProfile, UploadMode, LiveTranscription } from './types';
import PanelLeft from './components/PanelLeft';
import PanelRight from './components/PanelRight';
import NotificationSidebar from './components/NotificationSidebar';
import UploadCircle from './components/UploadCircle';
import Modal from './components/Modals';
import { analyzeMedia, generateFinalPrompt } from './services/geminiService';
import { saveToHistory, getHistory } from './services/historyService';
import { auth, rtdb } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import { Zap, LogOut, Cloud, Key, Info, Mic, CheckCircle2, MicOff, Menu, X, Rocket } from 'lucide-react';
import { LiveArchitectSession } from './services/liveService';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [prompt, setPrompt] = useState<FinalPrompt | null>(null);
  const [instructions, setInstructions] = useState('');
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [lastMediaBase64, setLastMediaBase64] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<UploadMode>('video');
  
  // Live states
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [liveTranscriptions, setLiveTranscriptions] = useState<LiveTranscription[]>([]);
  const [liveStatus, setLiveStatus] = useState<string>('');
  const liveSessionRef = useRef<LiveArchitectSession | null>(null);
  
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [checkingKey, setCheckingKey] = useState(true);
  const [user, setUser] = useState<{ email: string; uid: string; displayName?: string } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const analysisRef = useRef<AnalysisResult | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      const envKey = process.env.API_KEY;
      const isKeyPresent = envKey && envKey !== "undefined" && envKey !== "";
      if (window.aistudio) {
        const hasSelected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasSelected || !!isKeyPresent);
      } else {
        setHasApiKey(!!isKeyPresent);
      }
      setCheckingKey(false);
    };
    checkKey();

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({ email: firebaseUser.email || '', uid: firebaseUser.uid, displayName: firebaseUser.displayName || undefined });
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

    return unsubscribeAuth;
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    } else {
      alert("Please open this app in Google AI Studio or set the API_KEY environment variable.");
    }
  };

  const startLiveSession = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        alert("Live screen audit is not supported by your browser.");
        return;
      }

      setStatus(AppStatus.LIVE);
      setUploadMode('live');
      setIsLeftOpen(true);
      
      let displayStream: MediaStream;
      try {
        displayStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: { displaySurface: "monitor" },
          audio: false 
        });
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.message?.toLowerCase().includes('denied')) {
          throw new Error("Screen sharing was cancelled.");
        }
        throw err;
      }

      setLiveStream(displayStream);
      setLiveTranscriptions([]);
      setLiveStatus('Connecting to AI Architect...');

      liveSessionRef.current = new LiveArchitectSession(
        (t) => setLiveTranscriptions(prev => {
          const index = prev.findIndex(item => item.id === t.id);
          if (index !== -1) {
            const newArr = [...prev];
            newArr[index] = t;
            return newArr;
          }
          return [...prev, t];
        }),
        (s) => setLiveStatus(s)
      );

      await liveSessionRef.current.start(displayStream);
      
      displayStream.getVideoTracks()[0].onended = stopLiveSession;
    } catch (err: any) {
      console.error("Live session failed:", err);
      alert(err.message || "Could not start live audit session.");
      stopLiveSession();
    }
  };

  const stopLiveSession = async () => {
    // Save live session to history before stopping
    if (liveTranscriptions.length > 0) {
      const fullConversation = liveTranscriptions
        .map(t => `${t.role === 'user' ? 'USER' : 'ARCHITECT'}: ${t.text}`)
        .join('\n\n');

      const liveSummaryAnalysis: AnalysisResult = {
        pages: ["Live Environment"],
        elements: [{ type: "Live Transcript", description: "Archived Conversation", canEdit: false }],
        reasoning: ["Live Architectural Audit archived on session end"],
        spokenIntent: `Live session summary: ${liveTranscriptions.length} messages exchanged.`
      };

      try {
        const newItem = await saveToHistory({
          instructions: "Live Architect Audit Session",
          analysis: liveSummaryAnalysis,
          prompt: { content: fullConversation }
        });
        setHistoryItems(prev => [newItem, ...prev]);
      } catch (e) {
        console.error("Failed to save live session to history", e);
      }
    }

    if (liveSessionRef.current) {
      liveSessionRef.current.stop();
      liveSessionRef.current = null;
    }
    if (liveStream) {
      liveStream.getTracks().forEach(track => track.stop());
      setLiveStream(null);
    }
    setStatus(AppStatus.IDLE);
    setUploadMode('video');
  };

  const triggerPromptGeneration = async (currentAnalysis: AnalysisResult, manualInstructions: string) => {
    try {
      setStatus(AppStatus.GENERATING_PROMPT);
      setIsRightOpen(true);
      const finalResult = await generateFinalPrompt(currentAnalysis, manualInstructions);
      setPrompt(finalResult);
      setStatus(AppStatus.COMPLETED);

      const newItem = await saveToHistory({
        instructions: manualInstructions || currentAnalysis.spokenIntent || "Multimodal Audit",
        analysis: currentAnalysis,
        prompt: finalResult
      }, lastMediaBase64 || undefined);
      setHistoryItems(prev => [newItem, ...prev]);
    } catch (error: any) {
      if (error.message === "API_KEY_INVALID" || error.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        setStatus(AppStatus.IDLE);
      } else {
        alert(error.message);
        setStatus(AppStatus.READY_FOR_PROMPT);
      }
    }
  };

  const handleMediaUpload = async (file: File) => {
    try {
      setStatus(AppStatus.ANALYZING);
      setIsLeftOpen(true);
      setPrompt(null);
      setAnalysis(null);
      setInstructions('');
      
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const parts = (reader.result as string).split(',');
          const base64 = parts[1];
          const mimeType = parts[0].split(':')[1].split(';')[0];
          
          setLastMediaBase64(base64);
          const result = await analyzeMedia(base64, mimeType);
          setAnalysis(result);
          analysisRef.current = result;

          if (result.spokenIntent && result.spokenIntent.trim().length > 0) {
            setInstructions(result.spokenIntent);
          }
          
          setStatus(AppStatus.READY_FOR_PROMPT);
        } catch (error: any) {
          if (error.message === "API_KEY_INVALID" || error.message?.includes("Requested entity was not found")) {
            setHasApiKey(false);
            setStatus(AppStatus.IDLE);
          } else {
            alert(error.message);
            setStatus(AppStatus.IDLE);
          }
        }
      };
    } catch (error) {
      setStatus(AppStatus.IDLE);
      alert("Error processing upload.");
    }
  };

  if (checkingKey) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
    </div>
  );

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full glass-card p-10 rounded-[40px] border border-white/10 shadow-2xl space-y-8 animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-blue-500/10 rounded-[30px] flex items-center justify-center mx-auto">
            <Key className="w-10 h-10 text-blue-400" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">API Key Required</h1>
            <p className="text-white/40 text-sm">Connect a paid Google Cloud Project API Key.</p>
          </div>
          <button onClick={handleSelectKey} className="w-full py-4 bg-white text-black rounded-2xl font-black text-lg hover:bg-blue-400 hover:text-white transition-all transform active:scale-95 shadow-xl">
            Connect API Key
          </button>
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
        
        <button 
          onClick={() => setActiveModal('upgrade')}
          className="px-6 py-2 text-sm font-bold rounded-xl transition-all flex items-center gap-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500 hover:text-white shadow-lg"
        >
          <Rocket className="w-4 h-4" /> Upgrade Pro
        </button>

        <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
        <button 
          onClick={() => setIsNotificationOpen(true)}
          className="p-2.5 hover:bg-white/10 rounded-xl transition-all text-white/60 hover:text-white"
        >
          <Menu className="w-5 h-5" />
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

      <PanelLeft 
        isOpen={isLeftOpen} 
        analysis={analysis} 
        loading={status === AppStatus.ANALYZING} 
        liveTranscriptions={status === AppStatus.LIVE ? liveTranscriptions : undefined}
        liveStatus={status === AppStatus.LIVE ? liveStatus : undefined}
      />
      <PanelRight isOpen={isRightOpen} prompt={prompt} loading={status === AppStatus.GENERATING_PROMPT} />
      <NotificationSidebar 
        isOpen={isNotificationOpen} 
        onClose={() => setIsNotificationOpen(false)} 
        onSelectMode={(mode) => {
          setUploadMode(mode);
          setAnalysis(null);
          setPrompt(null);
          setStatus(AppStatus.IDLE);
        }}
        onStartLiveSession={startLiveSession}
        history={historyItems}
      />

      <main className={`flex-grow flex flex-col items-center justify-center transition-all duration-500 ${isLeftOpen && isRightOpen ? 'px-[450px]' : isLeftOpen ? 'pl-[380px]' : isRightOpen ? 'pr-[420px]' : ''}`}>
        <div className="max-w-2xl w-full flex flex-col items-center gap-10 px-6 mt-12">
          {status === AppStatus.LIVE && (
            <div className="flex items-center gap-3 px-6 py-2 bg-red-500/10 border border-red-500/20 rounded-full animate-in slide-in-from-top-4">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Live Audit Session Active</span>
              <button onClick={stopLiveSession} className="ml-4 text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
          )}
          
          <header className="text-center">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">PromptForge AI</h1>
            <p className="text-white/40 text-[10px] uppercase tracking-[0.4em] mt-3">Architect & Multimodal Auditor</p>
          </header>

          <UploadCircle 
            onFileSelect={handleMediaUpload} 
            isAnalyzing={status === AppStatus.ANALYZING} 
            hasLoaded={!!analysis} 
            mode={uploadMode}
            liveStream={liveStream}
          />

          <div className="w-full bg-[#0c0c0c] border border-white/10 rounded-[32px] p-2 flex flex-col shadow-2xl group transition-all hover:border-blue-500/20">
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={status === AppStatus.LIVE ? "I'm listening to your voice instructions..." : (analysis ? "Type your edit instructions here..." : "Provide context via Upload or Live Session...")}
              className="w-full h-32 bg-transparent p-6 text-sm resize-none focus:outline-none placeholder:text-white/20"
              disabled={status === AppStatus.ANALYZING || (status !== AppStatus.LIVE && !analysis)}
            />
            <div className="flex items-center justify-between p-2 pl-6">
              <span className="text-[10px] uppercase tracking-widest text-white/20 font-bold flex items-center gap-2">
                {status === AppStatus.LIVE ? (
                  <><Mic className="w-3 h-3 text-blue-400" /> Voice Context Captured</>
                ) : analysis?.spokenIntent ? (
                  <><Mic className="w-3 h-3 text-blue-400" /> Voice Analyzed</>
                ) : analysis ? (
                  <><CheckCircle2 className="w-3 h-3 text-blue-400" /> Audit Ready</>
                ) : (
                  `${instructions.length} characters`
                )}
              </span>
              <button
                onClick={() => (analysis || status === AppStatus.LIVE) && triggerPromptGeneration(analysisRef.current || { pages: [], elements: [], reasoning: [], spokenIntent: instructions }, instructions)}
                disabled={(status !== AppStatus.LIVE && !analysis) || status === AppStatus.ANALYZING || status === AppStatus.GENERATING_PROMPT}
                className="px-8 py-3 bg-white text-black rounded-2xl font-bold hover:bg-blue-400 hover:text-white disabled:opacity-20 transition-all flex items-center gap-3"
              >
                {status === AppStatus.GENERATING_PROMPT ? (
                   <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Forging...</span>
                ) : (
                  <><Zap className="w-4 h-4" /> {status === AppStatus.LIVE ? 'Forge Capture' : 'Generate Prompt'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-50">
          <button onClick={() => setIsLeftOpen(!isLeftOpen)} className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase transition-all border ${isLeftOpen ? 'bg-blue-500 border-blue-400' : 'bg-white/5 border-white/10 text-white/40'}`}>Audit View</button>
          <button onClick={() => setIsRightOpen(!isRightOpen)} className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase transition-all border ${isRightOpen ? 'bg-purple-500 border-purple-400' : 'bg-white/5 border-white/10 text-white/40'}`}>Prompt View</button>
      </div>
    </div>
  );
};

export default App;
