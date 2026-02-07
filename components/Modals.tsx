
import React, { useState, useEffect } from 'react';
import { HistoryItem, ModalType, UserProfile } from '../types';
import { X, Clock, Zap, Check, Loader2, Lock, ArrowRight, Smartphone, CheckCircle2, ShieldCheck, Database, CreditCard, MessageSquare, Activity } from 'lucide-react';
import { auth, googleProvider, rtdb } from '../services/firebase';
import { ref, set, get, update, onValue } from "firebase/database";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  updateProfile
} from 'firebase/auth';

interface ModalProps {
  type: ModalType;
  onClose: () => void;
  history?: HistoryItem[];
  onSelectHistory?: (item: HistoryItem) => void;
}

const Modal: React.FC<ModalProps> = ({ 
  type, 
  onClose, 
  history, 
  onSelectHistory 
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Payment States
  const [txnId, setTxnId] = useState('');
  const [paymentStep, setPaymentStep] = useState<'DETAILS' | 'QR' | 'VERIFY' | 'SUCCESS'>('DETAILS');
  const [currencyData, setCurrencyData] = useState({ code: 'INR', symbol: '₹', amount: 168 });

  useEffect(() => {
    const isIndia = navigator.language.includes('hi') || navigator.language.includes('IN');
    if (isIndia) {
      setCurrencyData({ code: 'INR', symbol: '₹', amount: 168 });
    } else {
      setCurrencyData({ code: 'USD', symbol: '$', amount: 2 });
    }
  }, []);

  if (!type) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const sanitizedEmail = email.trim().toLowerCase();
      if (isLogin) {
        // Standard Firebase login
        await signInWithEmailAndPassword(auth, sanitizedEmail, password);
      } else {
        // Sign up flow
        const userCred = await createUserWithEmailAndPassword(auth, sanitizedEmail, password);
        await updateProfile(userCred.user, { displayName: name });
        await set(ref(rtdb, `users/${userCred.user.uid}/profile`), {
          name,
          email: sanitizedEmail,
          isPro: false,
          lastLogin: Date.now()
        });
      }
      onClose();
    } catch (err: any) {
      console.error("Auth Error Code:", err.code);
      // Map Firebase codes to user-friendly messages
      // auth/invalid-credential is the generic error for wrong email/password in Firebase v9+
      if (err.code === 'auth/invalid-credential') {
        setError("Wrong email or password. Please verify your credentials.");
      } else if (err.code === 'auth/user-not-found') {
        setError("Account not found. Please register first.");
      } else if (err.code === 'auth/wrong-password') {
        setError("Invalid password. Try again.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("This email is already in use. Try signing in.");
      } else if (err.code === 'auth/weak-password') {
        setError("Password should be at least 6 characters.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Please enter a valid email address.");
      } else {
        setError("Authentication failed. " + (err.message || "Please check your network."));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const profileRef = ref(rtdb, `users/${user.uid}/profile`);
      const snapshot = await get(profileRef);
      if (!snapshot.exists()) {
        await set(profileRef, {
          name: user.displayName || 'Anonymous',
          email: user.email,
          isPro: false,
          lastLogin: Date.now()
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePaymentVerify = async () => {
    if (txnId.length < 8) {
      setError("Please enter a valid UPI Transaction ID.");
      return;
    }
    setLoading(true);
    const user = auth.currentUser;
    if (!user) return;

    try {
      const expiryDate = Date.now() + (30 * 24 * 60 * 60 * 1000); 
      const paymentData = {
        isPro: true,
        subscriptionExpiry: expiryDate,
        paidAmount: `${currencyData.symbol}${currencyData.amount}`,
        currency: currencyData.code,
        txnId: txnId,
        paymentDate: Date.now()
      };

      await update(ref(rtdb, `users/${user.uid}/profile`), paymentData);
      await set(ref(rtdb, `payments/${txnId}`), {
        ...paymentData,
        uid: user.uid,
        userName: user.displayName || user.email?.split('@')[0],
        userEmail: user.email
      });

      setPaymentStep('SUCCESS');
    } catch (err: any) {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderHistory = () => (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
      <div className="flex items-center gap-2 text-[10px] font-black text-white/30 uppercase tracking-[0.25em] mb-4 px-2">
        <Clock className="w-3 h-3" /> Audit & Session Logs
      </div>
      {history && history.length > 0 ? (
        history.map((item) => (
          <div 
            key={item.id} 
            onClick={() => onSelectHistory?.(item)}
            className="p-5 bg-white/5 border border-white/10 rounded-[28px] hover:bg-white/10 hover:border-blue-500/30 transition-all cursor-pointer group animate-in fade-in slide-in-from-bottom-2"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="text-[9px] text-white/30 uppercase tracking-widest font-black">
                {new Date(item.timestamp).toLocaleString()}
              </div>
              <div className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                item.instructions.includes('Live') 
                ? 'bg-red-500/20 text-red-400 border border-red-500/20' 
                : 'bg-purple-500/20 text-purple-400 border border-purple-500/20'
              }`}>
                {item.instructions.includes('Live') ? 'Live Architect' : 'Multimodal Forge'}
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/5">
                {item.instructions.includes('Live') ? (
                  <Activity className="w-5 h-5 text-red-400" />
                ) : (
                  <Zap className="w-5 h-5 text-purple-400" />
                )}
              </div>
              <div className="flex-grow">
                <p className="text-sm font-bold text-white/90 group-hover:text-white line-clamp-1 leading-tight mb-1">
                  {item.instructions}
                </p>
                <p className="text-[11px] text-white/40 line-clamp-2 italic leading-relaxed font-medium">
                  {item.prompt.content.substring(0, 100)}...
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
               <span className="text-[8px] text-white/20 uppercase font-black tracking-widest flex items-center gap-1.5">
                 <Database className="w-2.5 h-2.5" />
                 ID: {item.id.substring(0, 10)}
               </span>
               <div className="flex items-center gap-1 text-[9px] text-blue-400 font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                 Open Log <ArrowRight className="w-3 h-3" />
               </div>
            </div>
          </div>
        ))
      ) : (
        <div className="py-20 text-center opacity-20">
          <Clock className="w-16 h-16 mx-auto mb-4" />
          <p className="text-sm font-bold uppercase tracking-widest">No activity logs found</p>
        </div>
      )}
    </div>
  );

  const renderAuth = () => (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="text-center">
        <div className="w-20 h-20 bg-blue-500/10 rounded-[30px] flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10 text-blue-400" />
        </div>
        <h3 className="text-2xl font-bold tracking-tight">{isLogin ? 'Forge Login' : 'Create Account'}</h3>
        <p className="text-white/40 text-xs mt-2 italic font-medium">Access your global forge history</p>
      </div>
      <form onSubmit={handleAuth} className="space-y-4">
        {!isLogin && (
          <input 
            type="text" required value={name} onChange={(e) => setName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-500/50 transition-all text-sm" 
            placeholder="Display Name"
          />
        )}
        <input 
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-500/50 transition-all text-sm" 
          placeholder="Email Address"
        />
        <input 
          type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-500/50 transition-all text-sm" 
          placeholder="Password"
        />
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold p-4 rounded-xl text-center uppercase tracking-widest">
            {error}
          </div>
        )}
        <button type="submit" disabled={loading} className="w-full py-5 bg-white text-black rounded-2xl font-black text-lg hover:bg-blue-400 hover:text-white transition-all transform active:scale-[0.98] shadow-xl">
          {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : isLogin ? 'Sign In' : 'Register Account'}
        </button>
      </form>
      <div className="relative flex items-center py-2">
        <div className="flex-grow border-t border-white/5"></div>
        <span className="flex-shrink mx-4 text-[9px] text-white/20 uppercase font-black">Secure Entry</span>
        <div className="flex-grow border-t border-white/5"></div>
      </div>
      <button onClick={handleGoogleSignIn} className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-white/10 transition-all text-sm">
        <Smartphone className="w-5 h-5" /> Quick Google Entry
      </button>
      <div className="text-center pt-2">
        <button 
          type="button"
          onClick={() => { setIsLogin(!isLogin); setError(null); }} 
          className="text-white/40 hover:text-blue-400 text-sm font-medium underline underline-offset-4 decoration-white/10"
        >
          {isLogin ? "Need an account? Sign up here" : "Have an ID? Sign in here"}
        </button>
      </div>
    </div>
  );

  const renderUpgrade = () => (
    <div className="space-y-8 animate-in zoom-in-95 duration-300">
      <div className="text-center">
        <div className="w-20 h-20 bg-yellow-500/10 rounded-[30px] flex items-center justify-center mx-auto mb-6">
          <Zap className="w-10 h-10 text-yellow-400" />
        </div>
        <h3 className="text-3xl font-bold tracking-tight">Forge Pro</h3>
        <p className="text-white/40 text-sm mt-2 font-medium">Global AI Architect Intelligence</p>
      </div>
      <div className="p-8 bg-gradient-to-br from-white/10 to-transparent border border-white/10 rounded-[40px] text-center shadow-2xl relative overflow-hidden group">
        <div className="text-xs font-black text-white/40 uppercase tracking-[0.3em] mb-2">Architect Pass</div>
        <div className="text-6xl font-black mb-1">{currencyData.symbol}{currencyData.amount}</div>
        <div className="text-[10px] text-white/20 uppercase font-black tracking-[0.4em] mt-2">One-time payment / 30 Days</div>
      </div>
      <div className="grid gap-3">
        {[
          { icon: <ShieldCheck className="w-4 h-4 text-green-400" />, title: 'High-Precision Audit Engine' },
          { icon: <Activity className="w-4 h-4 text-red-400" />, title: 'Unlimited Live Architect Sessions' },
          { icon: <Database className="w-4 h-4 text-purple-400" />, title: 'Advanced Cloud Sync & History' }
        ].map((feat, i) => (
          <div key={i} className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5 transition-colors hover:border-white/10">
            {feat.icon}
            <span className="text-xs font-bold text-white/70 uppercase tracking-wider">{feat.title}</span>
          </div>
        ))}
      </div>
      <button 
        onClick={() => setPaymentStep('QR')}
        className="w-full py-5 bg-white text-black rounded-[28px] font-black text-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
      >
        Unlock Pro Access <ArrowRight className="w-6 h-6" />
      </button>
    </div>
  );

  const renderPayment = () => (
    <div className="space-y-8 text-center animate-in slide-in-from-right-4 duration-500">
      {paymentStep === 'QR' && (
        <>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold tracking-tight">Pay {currencyData.symbol}{currencyData.amount} via UPI</h3>
            <p className="text-sm text-white/40 italic font-medium">30 Days Pro Access Activation</p>
          </div>
          <div className="p-6 bg-white rounded-[40px] mx-auto w-fit shadow-[0_0_80px_rgba(255,255,255,0.1)] border border-white/10">
            <div className="w-60 h-60 bg-white flex items-center justify-center rounded-2xl overflow-hidden">
               <img 
                 src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=mab.037322044320156@axisbank%26pn=PROMPT%20FORGE%26am=${currencyData.amount}%26cu=INR`} 
                 alt="Payment QR" 
                 className="w-full h-full p-2"
               />
            </div>
          </div>
          <div className="flex flex-col gap-5 px-4">
            <div className="flex items-center justify-center gap-3 px-6 py-2 bg-white/5 rounded-full border border-white/10 w-fit mx-auto">
              <ShieldCheck className="w-4 h-4 text-green-400" />
              <span className="text-[10px] text-white/50 uppercase font-black tracking-widest">Encrypted UPI Gateway</span>
            </div>
            <p className="text-xs text-white/40 leading-relaxed max-w-[280px] mx-auto font-medium">
              Scan with GPay, Paytm or PhonePe. Copy your 12-digit transaction ID for instant verification.
            </p>
            <button 
              onClick={() => setPaymentStep('VERIFY')}
              className="w-full py-5 bg-blue-600 text-white rounded-[28px] font-black text-lg hover:bg-blue-500 transition-all shadow-xl active:scale-95"
            >
              Enter Transaction ID
            </button>
          </div>
        </>
      )}
      {paymentStep === 'VERIFY' && (
        <div className="space-y-8 py-4">
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold tracking-tight">Activate Your Pass</h3>
            <p className="text-xs text-white/40 uppercase font-black tracking-[0.2em]">UPI Transaction Ref ID</p>
          </div>
          <input 
            type="text" 
            value={txnId} 
            onChange={(e) => setTxnId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            className="w-full bg-white/5 border-2 border-white/10 rounded-[28px] px-8 py-6 text-center text-4xl font-mono focus:outline-none focus:border-blue-500 transition-all uppercase placeholder:opacity-10"
            placeholder="REF000..."
            maxLength={12}
          />
          {error && (
             <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black p-3 rounded-xl text-center uppercase tracking-widest">
               {error}
             </div>
          )}
          <button 
            onClick={handlePaymentVerify} disabled={loading}
            className="w-full py-5 bg-white text-black rounded-[28px] font-black text-xl flex items-center justify-center gap-3 transform active:scale-[0.98]"
          >
            {loading ? <Loader2 className="w-7 h-7 animate-spin" /> : 'Confirm Payment'}
          </button>
          <button onClick={() => setPaymentStep('QR')} className="text-white/20 text-[10px] uppercase font-bold hover:text-white transition-colors tracking-widest underline decoration-white/5 underline-offset-4">Back to QR</button>
        </div>
      )}
      {paymentStep === 'SUCCESS' && (
        <div className="py-12 space-y-8 animate-in zoom-in-95 duration-700">
          <div className="relative mx-auto w-32 h-32">
            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
            <div className="relative w-32 h-32 bg-green-500/30 rounded-full flex items-center justify-center border-4 border-green-500/50 shadow-[0_0_40px_rgba(34,197,94,0.3)]">
              <Check className="w-16 h-16 text-green-400" />
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-4xl font-black text-white tracking-tight">Access Granted</h3>
            <p className="text-white/50 font-bold uppercase text-[10px] tracking-[0.4em]">Unlimited Pro Architect Forge Active</p>
          </div>
          <button onClick={onClose} className="w-full py-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-[28px] font-black text-lg transition-all">
            Return to Dashboard
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[56px] shadow-[0_0_100px_rgba(0,0,0,0.8)] relative overflow-hidden p-8 md:p-14 border border-white/5">
        {/* Decorative background glows */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-blue-500/10 blur-[120px] pointer-events-none"></div>
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-purple-500/10 blur-[120px] pointer-events-none"></div>
        
        <button onClick={onClose} className="absolute top-10 right-10 p-3 hover:bg-white/5 rounded-full text-white/20 hover:text-white transition-all z-[110]">
          <X className="w-6 h-6" />
        </button>
        
        <div className="relative z-10">
          {type === 'history' && renderHistory()}
          {type === 'signup' && renderAuth()}
          {type === 'upgrade' && (paymentStep === 'DETAILS' ? renderUpgrade() : renderPayment())}
        </div>
      </div>
    </div>
  );
};

export default Modal;
