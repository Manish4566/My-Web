
import React, { useState } from 'react';
import { HistoryItem, ModalType } from '../types';
import { X, Clock, User, Zap, Star, Shield, Check, Mail, Loader2, Cloud, Lock, UserCircle, ArrowRight } from 'lucide-react';
import { auth, googleProvider } from '../services/firebase';
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
  onSignupSuccess?: (email: string) => void;
}

const Modal: React.FC<ModalProps> = ({ type, onClose, history, onSelectHistory, onSignupSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastErrorCode, setLastErrorCode] = useState<string | null>(null);

  if (!type) return null;

  const getErrorMessage = (errorCode: string) => {
    switch (errorCode) {
      case 'auth/invalid-credential': 
        return isLogin 
          ? 'Authentication failed. Please verify your email and password, or create a new account if you haven’t yet.' 
          : 'Registration failed. Please ensure your email is valid and you meet password requirements.';
      case 'auth/user-not-found': return 'No account found with this email. Please click "Sign Up" below.';
      case 'auth/wrong-password': return 'Incorrect password. Try again or use Google to sign in.';
      case 'auth/email-already-in-use': return 'An account with this email already exists. Try "Sign In" instead.';
      case 'auth/weak-password': return 'Password is too weak. Please use at least 6 characters.';
      case 'auth/invalid-email': return 'The email address provided is not valid.';
      default: return `Unexpected error: ${errorCode}. Please check your connection or try again.`;
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (!isLogin && !name) {
      setError("Please enter your full name.");
      setLastErrorCode(null);
      return;
    }
    
    setIsAuthLoading(true);
    setError(null);
    setLastErrorCode(null);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, {
          displayName: name
        });
      }
      onSignupSuccess?.(email);
      onClose();
    } catch (err: any) {
      console.error("Firebase Auth Error:", err.code, err.message);
      setLastErrorCode(err.code);
      setError(getErrorMessage(err.code));
      setPassword(''); // Clear password on error for security and fresh attempt
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleInputChange = (field: 'email' | 'password' | 'name', value: string) => {
    if (field === 'email') setEmail(value);
    if (field === 'password') setPassword(value);
    if (field === 'name') setName(value);
    
    // Clear error immediately when user starts typing again
    if (error) {
      setError(null);
      setLastErrorCode(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsAuthLoading(true);
    setError(null);
    setLastErrorCode(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        onSignupSuccess?.(result.user.email || 'User');
        onClose();
      }
    } catch (err: any) {
      console.error("Google Auth Error:", err.code, err.message);
      setLastErrorCode(err.code);
      setError(getErrorMessage(err.code));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setError(null);
    setLastErrorCode(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      <div className="relative w-full max-w-2xl bg-[#0c0c0c] border border-white/10 rounded-[32px] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold capitalize flex items-center gap-3">
              {type === 'history' && <Clock className="text-blue-400" />}
              {type === 'signup' && (isLogin ? <User className="text-blue-400" /> : <Zap className="text-purple-400" />)}
              {type === 'upgrade' && <Zap className="text-yellow-400" />}
              {type === 'signup' ? (isLogin ? 'Sign In' : 'Create Account') : type}
            </h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {type === 'history' && (
              <div className="space-y-4">
                {history && history.length > 0 ? (
                  history.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => onSelectHistory?.(item)}
                      className="group p-5 bg-white/5 border border-white/5 rounded-2xl cursor-pointer hover:border-blue-500/30 hover:bg-white/[0.08] transition-all"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-col">
                           <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-white/30">
                              {new Date(item.timestamp).toLocaleString()}
                            </span>
                            <Cloud className="w-3 h-3 text-blue-500/40" />
                          </div>
                          {item.userName && (
                            <span className="text-[10px] text-white/20 mt-1">Generated by: {item.userName}</span>
                          )}
                        </div>
                        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full uppercase font-bold">
                          {item.analysis.pages.length} Pages
                        </span>
                      </div>
                      <p className="text-sm text-white/70 line-clamp-2 italic">
                        "{item.instructions}"
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center text-white/20">
                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p>No history found. Complete an analysis to see it here.</p>
                  </div>
                )}
              </div>
            )}

            {type === 'signup' && (
              <div className="space-y-6">
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl animate-in fade-in slide-in-from-top-1 flex flex-col gap-2">
                      <div className="flex gap-3 items-center">
                        <Lock className="w-4 h-4 shrink-0" />
                        <span className="font-medium">{error}</span>
                      </div>
                      
                      {/* ACTION: Switch to Sign In if email is taken */}
                      {lastErrorCode === 'auth/email-already-in-use' && (
                        <button 
                          type="button"
                          onClick={() => { setIsLogin(true); setError(null); setLastErrorCode(null); }}
                          className="text-left ml-7 text-blue-400 hover:text-blue-300 hover:underline font-bold flex items-center gap-1 mt-1 transition-colors"
                        >
                          I have an account, sign me in <ArrowRight className="w-3 h-3" />
                        </button>
                      )}

                      {/* ACTION: Switch to Sign Up if login fails */}
                      {lastErrorCode === 'auth/invalid-credential' && isLogin && (
                        <button 
                          type="button"
                          onClick={() => { setIsLogin(false); setError(null); setLastErrorCode(null); }}
                          className="text-left ml-7 text-purple-400 hover:text-purple-300 hover:underline font-bold flex items-center gap-1 mt-1 transition-colors"
                        >
                          Need an account? Sign up here <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                  <div className="space-y-4">
                    {!isLogin && (
                      <div className="space-y-1.5 animate-in slide-in-from-left-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-white/40 ml-1">Full Name</label>
                        <div className="relative">
                          <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                          <input 
                            type="text" 
                            required
                            value={name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            placeholder="John Doe" 
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-purple-500/50 transition-all text-white"
                          />
                        </div>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-white/40 ml-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        <input 
                          type="email" 
                          required
                          value={email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          placeholder="name@company.com" 
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-blue-500/50 transition-all text-white"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-white/40 ml-1">Password</label>
                      <input 
                        type="password" 
                        required
                        value={password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        placeholder="••••••••" 
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500/50 transition-all text-white"
                      />
                    </div>
                  </div>
                  <button 
                    type="submit"
                    disabled={isAuthLoading}
                    className={`w-full font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                      isLogin 
                        ? 'bg-white text-black hover:bg-gray-200' 
                        : 'bg-purple-600 text-white hover:bg-purple-500 shadow-[0_0_20px_rgba(147,51,234,0.3)]'
                    }`}
                  >
                    {isAuthLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                    {isAuthLoading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                  </button>
                  
                  <p className="text-center text-sm text-white/40">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                    <button 
                      type="button"
                      onClick={toggleAuthMode}
                      className={`${isLogin ? 'text-purple-400' : 'text-blue-400'} hover:underline font-semibold`}
                    >
                      {isLogin ? 'Sign Up for Free' : 'Sign In instead'}
                    </button>
                  </p>
                </form>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#0c0c0c] px-2 text-white/20">Fast Access</span></div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <button 
                    type="button" 
                    onClick={handleGoogleSignIn}
                    disabled={isAuthLoading}
                    className="flex items-center justify-center gap-3 py-3 border border-white/10 rounded-xl hover:bg-white/5 transition-all text-sm font-medium"
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" className="w-5 h-5" alt="Google" />
                    Continue with Google
                  </button>
                </div>
              </div>
            )}

            {type === 'upgrade' && (
              <div className="space-y-8">
                <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/20 p-6 rounded-3xl">
                  <div className="flex items-center gap-3 mb-2 text-yellow-500 font-bold uppercase tracking-tighter italic text-xl">
                    <Star className="w-6 h-6 fill-current" />
                    Pro Access
                  </div>
                  <p className="text-white/60 text-sm mb-6 leading-relaxed">
                    Unlock the full potential of PromptForge with advanced models and team tools.
                  </p>
                  <div className="text-4xl font-black text-white mb-6">$2<span className="text-lg font-normal text-white/40">/mo</span></div>
                  <button className="w-full bg-yellow-500 text-black font-black py-4 rounded-xl hover:bg-yellow-400 transition-transform active:scale-95 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                    Upgrade Now
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { title: 'Unlimited Video Analysis', icon: <Zap className="w-4 h-4 text-yellow-500" /> },
                    { title: 'Gemini 3 Pro Access', icon: <Star className="w-4 h-4 text-blue-500" /> },
                    { title: 'Advanced Edit-Only Rules', icon: <Shield className="w-4 h-4 text-green-500" /> },
                    { title: 'Prompt History Export', icon: <Check className="w-4 h-4 text-purple-500" /> },
                  ].map((feat, i) => (
                    <div key={i} className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="p-2 bg-black rounded-lg">{feat.icon}</div>
                      <span className="text-sm font-medium text-white/80">{feat.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;