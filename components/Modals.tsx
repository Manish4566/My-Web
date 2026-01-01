
import React, { useState, useEffect } from 'react';
import { HistoryItem, ModalType, UserProfile } from '../types';
import { X, Clock, Zap, Check, Loader2, Lock, ArrowRight, Smartphone, CheckCircle2, ShieldCheck, Database, CreditCard } from 'lucide-react';
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const isIndia = navigator.language.includes('hi') || navigator.language.includes('IN');
    if (isIndia) {
      setCurrencyData({ code: 'INR', symbol: '₹', amount: 168 });
    } else {
      setCurrencyData({ code: 'USD', symbol: '$', amount: 2 });
    }

    const user = auth.currentUser;
    if (user) {
      const profileRef = ref(rtdb, `users/${user.uid}/profile`);
      return onValue(profileRef, (snapshot) => {
        if (snapshot.exists()) {
          setUserProfile(snapshot.val() as UserProfile);
        }
      });
    }
  }, []);

  if (!type) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, { displayName: name });
        await set(ref(rtdb, `users/${userCred.user.uid}/profile`), {
          name,
          email,
          isPro: false,
          lastLogin: Date.now()
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message);
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
      setError("Please enter a valid 12-digit UPI Transaction ID.");
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
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
      <div className="flex items-center gap-2 text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-4 px-2">
        <Clock className="w-3 h-3" /> Recent Forge Sessions
      </div>
      {history && history.length > 0 ? (
        history.map((item) => (
          <div 
            key={item.id} 
            onClick={() => onSelectHistory?.(item)}
            className="p-5 bg-white/5 border border-white/10 rounded-[24px] hover:bg-white/10 hover:border-blue-500/30 transition-all cursor-pointer group animate-in fade-in slide-in-from-bottom-2"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
                {new Date(item.timestamp).toLocaleDateString()}
              </div>
              <div className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full text-[9px] font-black uppercase tracking-wider">
                {item.analysis.pages.length} Screens
              </div>
            </div>
            <p className="text-sm font-medium text-white/80 group-hover:text-white line-clamp-2 leading-relaxed italic">
              "{item.instructions}"
            </p>
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
               <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest">{item.userName}</span>
               <ArrowRight className="w-3 h-3 text-white/20 group-hover:text-blue-400 transition-colors" />
            </div>
          </div>
        ))
      ) : (
        <div className="py-20 text-center opacity-20">
          <Clock className="w-16 h-16 mx-auto mb-4" />
          <p className="text-sm font-bold uppercase tracking-widest">Empty Forge</p>
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
        <h3 className="text-2xl font-bold">{isLogin ? 'Welcome Back' : 'Create Account'}</h3>
      </div>
      <form onSubmit={handleAuth} className="space-y-4">
        {!isLogin && (
          <input 
            type="text" required value={name} onChange={(e) => setName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-500/50" 
            placeholder="Full Name"
          />
        )}
        <input 
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-500/50" 
          placeholder="Email Address"
        />
        <input 
          type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-500/50" 
          placeholder="Password"
        />
        {error && <div className="text-red-400 text-xs text-center">{error}</div>}
        <button type="submit" disabled={loading} className="w-full py-4 bg-white text-black rounded-2xl font-black text-lg hover:bg-blue-400 hover:text-white transition-all">
          {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : isLogin ? 'Sign In' : 'Create Account'}
        </button>
      </form>
      <button onClick={handleGoogleSignIn} className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-white/10 transition-all">
        <Smartphone className="w-5 h-5" /> Google Account
      </button>
      <div className="text-center">
        <button onClick={() => setIsLogin(!isLogin)} className="text-white/40 hover:text-blue-400 text-sm">
          {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
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
        <h3 className="text-3xl font-bold">Forge Pro</h3>
        <p className="text-white/40 text-sm mt-2">Get 1 Month of Unlimited AI Audits</p>
      </div>
      <div className="p-8 bg-gradient-to-br from-white/10 to-transparent border border-white/10 rounded-[40px] text-center shadow-2xl relative overflow-hidden group">
        <div className="text-xs font-bold text-white/40 uppercase tracking-[0.2em] mb-2">30 Day Access</div>
        <div className="text-6xl font-black mb-1">{currencyData.symbol}{currencyData.amount}</div>
        <div className="text-[10px] text-white/20 uppercase font-black tracking-widest mt-2">One-time payment</div>
      </div>
      <div className="grid gap-3">
        {[
          { icon: <ShieldCheck className="w-4 h-4 text-green-400" />, title: 'Gemini 3 Pro Engine' },
          { icon: <CheckCircle2 className="w-4 h-4 text-purple-400" />, title: 'Priority Forge Queue' }
        ].map((feat, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
            {feat.icon}
            <span className="text-xs font-semibold text-white/70">{feat.title}</span>
          </div>
        ))}
      </div>
      <button 
        onClick={() => setPaymentStep('QR')}
        className="w-full py-5 bg-white text-black rounded-[24px] font-black text-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
      >
        Upgrade Now <ArrowRight className="w-6 h-6" />
      </button>
    </div>
  );

  const renderPayment = () => (
    <div className="space-y-8 text-center animate-in slide-in-from-right-4 duration-500">
      {paymentStep === 'QR' && (
        <>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold tracking-tight">Scan & Pay {currencyData.symbol}{currencyData.amount}</h3>
            <p className="text-sm text-white/40 italic">Account valid for exactly 1 month</p>
          </div>
          <div className="p-6 bg-white rounded-[40px] mx-auto w-fit shadow-[0_0_80px_rgba(255,255,255,0.15)] border-4 border-white/10">
            <div className="w-60 h-60 bg-white flex items-center justify-center rounded-2xl overflow-hidden">
               <img 
                 src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=mab.037322044320156@axisbank%26pn=PROMPT%20FORGE%26am=${currencyData.amount}%26cu=INR`} 
                 alt="PhonePe Payment QR" 
                 className="w-full h-full p-2"
               />
            </div>
          </div>
          <div className="flex flex-col gap-5 px-4">
            <div className="flex items-center justify-center gap-3 px-6 py-2 bg-white/5 rounded-full border border-white/10 w-fit mx-auto">
              <ShieldCheck className="w-4 h-4 text-green-400" />
              <span className="text-[10px] text-white/50 uppercase font-black tracking-widest">Secure UPI Payment</span>
            </div>
            <p className="text-xs text-white/40 leading-relaxed max-w-[280px] mx-auto">
              Open PhonePe, GPay, or Paytm to scan. Direct payment ensures immediate processing.
            </p>
            <button 
              onClick={() => setPaymentStep('VERIFY')}
              className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black text-lg hover:bg-blue-500 transition-all shadow-xl active:scale-95"
            >
              I have paid
            </button>
          </div>
        </>
      )}
      {paymentStep === 'VERIFY' && (
        <div className="space-y-8 py-4">
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold">Verification</h3>
            <p className="text-sm text-white/40">Enter the 12-digit UPI Transaction ID</p>
          </div>
          <input 
            type="text" 
            value={txnId} 
            onChange={(e) => setTxnId(e.target.value.toUpperCase())}
            className="w-full bg-white/5 border-2 border-white/10 rounded-[24px] px-8 py-6 text-center text-3xl font-mono focus:outline-none focus:border-blue-500 transition-all uppercase"
            placeholder="TXN..."
            maxLength={12}
          />
          {error && <div className="text-red-400 text-sm font-bold">{error}</div>}
          <button 
            onClick={handlePaymentVerify} disabled={loading}
            className="w-full py-5 bg-white text-black rounded-[24px] font-black text-xl flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 className="w-7 h-7 animate-spin" /> : 'Confirm Payment'}
          </button>
          <button onClick={() => setPaymentStep('QR')} className="text-white/20 text-[10px] uppercase font-bold hover:text-white transition-colors tracking-widest underline">Back to QR</button>
        </div>
      )}
      {paymentStep === 'SUCCESS' && (
        <div className="py-12 space-y-8 animate-in zoom-in-95 duration-700">
          <div className="relative mx-auto w-32 h-32">
            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
            <div className="relative w-32 h-32 bg-green-500/30 rounded-full flex items-center justify-center border-4 border-green-500/50">
              <Check className="w-16 h-16 text-green-400" />
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-4xl font-black text-white">Successful!</h3>
            <p className="text-white/50 font-medium">Your Pro account is now active for 30 days.</p>
          </div>
          <button onClick={onClose} className="w-full py-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-[24px] font-black text-lg transition-all">
            Continue to Dashboard
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-[#0c0c0c] border border-white/10 rounded-[48px] shadow-2xl relative overflow-hidden p-8 md:p-14">
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-500/10 blur-[100px] pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-500/10 blur-[100px] pointer-events-none"></div>
        <button onClick={onClose} className="absolute top-10 right-10 p-3 hover:bg-white/5 rounded-full text-white/30 hover:text-white transition-all z-[110]">
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
