
import React, { useState, useEffect, useRef } from 'react';
import { AppStatus, AnalysisResult, FinalPrompt, ModalType, HistoryItem, UserProfile, UploadMode, LiveTranscription, ChatMessage } from './types';
import PanelLeft from './components/PanelLeft';
import PanelRight from './components/PanelRight';
import NotificationSidebar from './components/NotificationSidebar';
import UploadCircle from './components/UploadCircle';
import Modal from './components/Modals';
import { analyzeMedia, generateFinalPrompt, chatWithMedia } from './services/geminiService';
import { saveToHistory, getHistory } from './services/historyService';
import { auth, rtdb } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import { Zap, LogOut, Cloud, Mic, CheckCircle2, Menu, X, Rocket, Activity, Send, MessageSquare } from 'lucide-react';
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
  const [lastMimeType, setLastMimeType] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<UploadMode>('video');
  
  // Live states
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [liveTranscriptions, setLiveTranscriptions] = useState<LiveTranscription[]>([]);
  const [liveStatus, setLiveStatus] = useState<string>('');
  const liveSessionRef = useRef<LiveArchitectSession | null>(null);
  
  const [user, setUser] = useState<{ email: string; uid: string; displayName?: string } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const refreshHistory = async () => {
    const history = await getHistory();
    setHistoryItems(history);
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({ email: firebaseUser.email || '', uid: firebaseUser.uid, displayName: firebaseUser.displayName || undefined });
        const profileRef = ref(rtdb, `users/${firebaseUser.uid}/profile`);
        onValue(profileRef, (snapshot) => {
          if (snapshot.exists()) {
            setUserProfile(snapshot.val() as UserProfile);
          }
        });
        refreshHistory();
      } else {
        setUser(null);
        setUserProfile(null);
      }
    });

    return unsubscribeAuth;
  }, []);

  const startLiveSession = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        alert("Live screen audit is not supported by your browser.");
        return;
      }
      setStatus(AppStatus.LIVE);
      setUploadMode('live');
      setIsLeftOpen(true);
      setPrompt(null);
      setAnalysis(null);
      let displayStream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "monitor" }, audio: false });
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
      stopLiveSession();
    }
  };

  const stopLiveSession = async () => {
    if (liveTranscriptions.length > 0) {
      const fullConversation = liveTranscriptions.map(t => `${t.role === 'user' ? 'USER' : 'ARCHITECT'}: ${t.text}`).join('\n\n');
      const liveSummary: AnalysisResult = {
        pages: ["Live Screen Audit"],
        elements: [{ type: "Session Log", description: "Real-time UI Dialogue", canEdit: false }],
        reasoning: ["Live Architectural Session completed"],
        spokenIntent: `Session captured with ${liveTranscriptions.length} dialogue turns.`
      };
      const newItem = await saveToHistory({
        instructions: "Live Architect Audit Session",
        analysis: liveSummary,
        prompt: { content: fullConversation }
      });
      setHistoryItems(prev => [newItem, ...prev]);
    }
    if (liveSessionRef.current) { liveSessionRef.current.stop(); liveSessionRef.current = null; }
    if (liveStream) { liveStream.getTracks().forEach(track => track.stop()); setLiveStream(null); }
    setStatus(AppStatus.IDLE);
    setUploadMode('video');
    refreshHistory();
  };

  const handleChatRequest = async () => {
    if (!instructions.trim() || !lastMediaBase64 || !lastMimeType) return;
    const msg = instructions.trim();
    setInstructions('');
    
    const userMsg: ChatMessage = { role: 'user', text: msg };
    const currentAnalysis = analysis || { pages: [], elements: [], reasoning: [], chatHistory: [] };
    const updatedHistory = [...(currentAnalysis.chatHistory || []), userMsg];
    
    setAnalysis({ ...currentAnalysis, chatHistory: updatedHistory });
    setStatus(AppStatus.ANALYZING);
    setIsLeftOpen(true);

    try {
      const responseText = await chatWithMedia(lastMediaBase64, lastMimeType, msg, updatedHistory);
      const modelMsg: ChatMessage = { role: 'model', text: responseText };
      const finalHistory = [...updatedHistory, modelMsg];
      
      setAnalysis({ ...currentAnalysis, chatHistory: finalHistory });
      setStatus(AppStatus.CHAT_WAITING);
    } catch (e: any) {
      alert(e.message);
      setStatus(AppStatus.CHAT_WAITING);
    }
  };

  const triggerPromptGeneration = async () => {
    if (!analysis && !lastMediaBase64) return;
    
    try {
      setStatus(AppStatus.GENERATING_PROMPT);
      setIsRightOpen(true);
      
      let currentAnalysis = analysis;
      if (!currentAnalysis && lastMediaBase64 && lastMimeType) {
        currentAnalysis = await analyzeMedia(lastMediaBase64, lastMimeType);
        setAnalysis(currentAnalysis);
      }

      const finalResult = await generateFinalPrompt(currentAnalysis!, instructions || "Generate optimized code edits.");
      setPrompt(finalResult);
      setStatus(AppStatus.COMPLETED);

      const newItem = await saveToHistory({
        instructions: instructions || currentAnalysis?.spokenIntent || "Architect Audit",
        analysis: currentAnalysis!,
        prompt: finalResult
      }, lastMediaBase64 || undefined);
      setHistoryItems(prev => [newItem, ...prev]);
      refreshHistory();
    } catch (error: any) {
      alert(error.message);
      setStatus(AppStatus.READY_FOR_PROMPT);
    }
  };

  const handleMediaUpload = async (file: File) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const parts = (reader.result as string).split(',');
      const base64 = parts[1];
      const mimeType = parts[0].split(':')[1].split(';')[0];
      setLastMediaBase64(base64);
      setLastMimeType(mimeType);
      setPrompt(null);
      setInstructions('');

      if (uploadMode === 'image' || uploadMode === 'pdf') {
        setAnalysis({ pages: [], elements: [], reasoning: [], chatHistory: [] });
        setStatus(AppStatus.CHAT_WAITING);
        setIsLeftOpen(true);
      } else {
        setStatus(AppStatus.ANALYZING);
        setIsLeftOpen(true);
        try {
          const result = await analyzeMedia(base64, mimeType);
          setAnalysis(result);
          if (result.spokenIntent) setInstructions(result.spokenIntent);
          setStatus(AppStatus.READY_FOR_PROMPT);
        } catch (e: any) {
          alert(e.message);
          setStatus(AppStatus.IDLE);
        }
      }
    };
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative overflow-hidden">
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[80] flex items-center bg-white/5 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shadow-2xl">
        <button onClick={() => { refreshHistory(); setActiveModal('history'); }} className="px-6 py-2 text-sm font-bold hover:bg-white/10 rounded-xl transition-all">History</button>
        <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
        {user ? (
          <div className="flex items-center">
            <div className="px-6 py-2 text-sm font-bold flex items-center gap-2 text-blue-400"><Cloud className="w-3 h-3" />{userProfile?.isPro && <CheckCircle2 className="w-3 h-3 text-green-400" />}{user.displayName || user.email.split('@')[0]}</div>
            <button onClick={() => signOut(auth)} className="p-2 hover:bg-red-500/10 rounded-xl text-white/50 hover:text-red-400 transition-colors"><LogOut className="w-4 h-4" /></button>
          </div>
        ) : <button onClick={() => setActiveModal('signup')} className="px-6 py-2 text-sm font-bold hover:bg-white/10 rounded-xl transition-all">Sign Up</button>}
        <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
        <button onClick={() => setActiveModal('upgrade')} className="px-6 py-2 text-sm font-bold rounded-xl transition-all flex items-center gap-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500 hover:text-white shadow-lg"><Rocket className="w-4 h-4" /> Upgrade Pro</button>
        <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
        <button onClick={() => setIsNotificationOpen(true)} className="p-2.5 hover:bg-white/10 rounded-xl transition-all text-white/60 hover:text-white"><Menu className="w-5 h-5" /></button>
      </div>

      <Modal type={activeModal} onClose={() => setActiveModal(null)} history={historyItems} onSelectHistory={(item) => { setAnalysis(item.analysis); setPrompt(item.prompt); setInstructions(item.instructions); setStatus(AppStatus.COMPLETED); setIsLeftOpen(true); setIsRightOpen(true); setActiveModal(null); }} />

      <PanelLeft isOpen={isLeftOpen} analysis={analysis} loading={status === AppStatus.ANALYZING} liveTranscriptions={status === AppStatus.LIVE ? liveTranscriptions : undefined} liveStatus={status === AppStatus.LIVE ? liveStatus : undefined} isChatMode={status === AppStatus.CHAT_WAITING || (analysis?.chatHistory && analysis.chatHistory.length > 0)} />
      <PanelRight isOpen={isRightOpen} prompt={prompt} loading={status === AppStatus.GENERATING_PROMPT} />
      <NotificationSidebar isOpen={isNotificationOpen} onClose={() => setIsNotificationOpen(false)} onSelectMode={(mode) => { setUploadMode(mode); setAnalysis(null); setPrompt(null); setStatus(AppStatus.IDLE); setLastMediaBase64(null); }} onStartLiveSession={startLiveSession} history={historyItems} />

      <main className={`flex-grow flex flex-col items-center justify-center transition-all duration-500 ${isLeftOpen && isRightOpen ? 'px-[450px]' : isLeftOpen ? 'pl-[380px]' : isRightOpen ? 'pr-[420px]' : ''}`}>
        <div className="max-w-2xl w-full flex flex-col items-center gap-10 px-6 mt-12">
          {status === AppStatus.LIVE && (
            <div className="flex items-center gap-3 px-6 py-2 bg-red-500/10 border border-red-500/20 rounded-full animate-in slide-in-from-top-4">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Live Architect Active</span>
              <button onClick={stopLiveSession} className="ml-4 text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
          )}
          <header className="text-center">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">PromptForge AI</h1>
            <p className="text-white/40 text-[10px] uppercase tracking-[0.4em] mt-3 font-medium">Architect & Multimodal Auditor</p>
          </header>

          <UploadCircle onFileSelect={handleMediaUpload} isAnalyzing={status === AppStatus.ANALYZING} hasLoaded={!!analysis} mode={uploadMode} liveStream={liveStream} />

          <div className="w-full bg-[#0c0c0c] border border-white/10 rounded-[32px] p-2 flex flex-col shadow-2xl group transition-all hover:border-blue-500/20">
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={status === AppStatus.CHAT_WAITING ? "Ask the architect a question about this media..." : "Type instructions or questions..."}
              className="w-full h-32 bg-transparent p-6 text-sm resize-none focus:outline-none placeholder:text-white/20 font-medium"
              onKeyDown={(e) => e.key === 'Enter' && e.shiftKey === false && status === AppStatus.CHAT_WAITING && (e.preventDefault(), handleChatRequest())}
            />
            <div className="flex items-center justify-between p-2 pl-6">
              <span className="text-[10px] uppercase tracking-widest text-white/20 font-black flex items-center gap-2">
                {status === AppStatus.CHAT_WAITING ? <><MessageSquare className="w-3 h-3 text-purple-400" /> Interactive Mode</> : analysis ? <><CheckCircle2 className="w-3 h-3 text-blue-400" /> Ready</> : "Awaiting media..."}
              </span>
              <div className="flex gap-2">
                {status === AppStatus.CHAT_WAITING && (
                  <button onClick={handleChatRequest} className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl border border-purple-500/20 hover:bg-purple-500 hover:text-white transition-all"><Send className="w-5 h-5" /></button>
                )}
                <button
                  onClick={triggerPromptGeneration}
                  disabled={!lastMediaBase64 || status === AppStatus.ANALYZING || status === AppStatus.GENERATING_PROMPT || status === AppStatus.LIVE}
                  className="px-8 py-3 bg-white text-black rounded-2xl font-black hover:bg-blue-400 hover:text-white disabled:opacity-20 transition-all flex items-center gap-3 shadow-xl"
                >
                  {status === AppStatus.GENERATING_PROMPT ? <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Forging...</> : <><Zap className="w-4 h-4" /> Forge Code</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-50">
          <button onClick={() => setIsLeftOpen(!isLeftOpen)} className={`px-6 py-2 rounded-full text-[10px] font-black uppercase transition-all border ${isLeftOpen ? 'bg-blue-500 border-blue-400 text-white shadow-lg' : 'bg-white/5 border-white/10 text-white/40'}`}>Audit View</button>
          <button onClick={() => setIsRightOpen(!isRightOpen)} className={`px-6 py-2 rounded-full text-[10px] font-black uppercase transition-all border ${isRightOpen ? 'bg-purple-500 border-purple-400 text-white shadow-lg' : 'bg-white/5 border-white/10 text-white/40'}`}>Prompt View</button>
      </div>
    </div>
  );
};

export default App;
