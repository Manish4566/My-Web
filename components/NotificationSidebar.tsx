
import React from 'react';
import { Upload, Video, FileText, Plus, X, ImageIcon, Mic } from 'lucide-react';
import { UploadMode } from '../types';

interface NotificationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode: (mode: UploadMode) => void;
  onStartLiveSession: () => void;
  history: any[]; // Kept for prop consistency
}

const NotificationSidebar: React.FC<NotificationSidebarProps> = ({ isOpen, onClose, onSelectMode, onStartLiveSession }) => {
  const handleModeChange = (mode: UploadMode) => {
    onSelectMode(mode);
    onClose();
  };

  const handleLiveClick = () => {
    onStartLiveSession();
    onClose();
  };

  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] transition-opacity duration-700"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <div 
        className={`fixed top-0 right-0 h-full w-[320px] sm:w-[380px] z-[100] transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } shadow-[-40px_0_80px_rgba(0,0,0,0.9)] overflow-hidden`}
        style={{
          background: 'linear-gradient(165deg, #000000 0%, #1a1a1a 40%, #756f6a 100%)',
        }}
      >
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.2),transparent_70%)] pointer-events-none"></div>
        <div className="absolute inset-y-0 left-0 w-[1px] bg-gradient-to-b from-white/20 via-white/5 to-transparent"></div>

        <div className="w-full h-full flex flex-col relative z-10 p-8 custom-scrollbar overflow-y-auto">
          {/* Header with Close */}
          <div className="flex items-center justify-between mb-12">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Quick Actions</span>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-all text-white/40 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Buttons Container */}
          <div className="flex flex-col gap-6">
            
            {/* Live Session Button */}
            <button 
              onClick={handleLiveClick}
              className="flex items-center justify-center gap-3 w-full bg-blue-600 hover:bg-blue-500 text-white py-6 rounded-2xl shadow-[0_0_30px_rgba(59,130,246,0.3)] transition-all transform hover:scale-[1.02] active:scale-95 group"
            >
              <Mic className="w-6 h-6 animate-pulse" />
              <span className="font-black text-xl tracking-tight">Live Architect Session</span>
            </button>

            <div className="h-[1px] w-full bg-white/5 my-2"></div>

            {/* Upload Image */}
            <button 
              onClick={() => handleModeChange('image')}
              className="flex items-center justify-center gap-3 w-full bg-[#111111] hover:bg-[#1a1a1a] text-white py-4 rounded-full border border-white/5 shadow-2xl transition-all transform hover:scale-[1.02] active:scale-95 group"
            >
              <ImageIcon className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
              <span className="font-semibold text-base">Upload Image</span>
            </button>

            {/* Video Upload */}
            <button 
              onClick={() => handleModeChange('video')}
              className="flex items-center justify-center gap-3 w-full bg-[#222222] hover:bg-[#2a2a2a] text-white py-4 rounded-xl border border-white/10 transition-all transform hover:translate-y-[-2px] active:translate-y-0 shadow-lg"
            >
              <div className="relative">
                <Video className="w-6 h-6" />
                <Plus className="w-3 h-3 absolute -bottom-1 -right-1 bg-white text-black rounded-full p-[1px]" />
              </div>
              <span className="font-bold text-lg">Upload Video</span>
            </button>

            {/* PDF Upload */}
            <button 
              onClick={() => handleModeChange('pdf')}
              className="flex items-center justify-center gap-3 w-full bg-[#222222] hover:bg-[#2a2a2a] text-white py-4 rounded-xl border border-white/10 transition-all transform hover:translate-y-[-2px] active:translate-y-0 shadow-lg"
            >
              <div className="relative">
                <FileText className="w-6 h-6" />
                <Plus className="w-3 h-3 absolute -bottom-1 -right-1 bg-white text-black rounded-full p-[1px]" />
              </div>
              <span className="font-bold text-lg">Upload PDF</span>
            </button>
            
          </div>

          {/* Bottom decorative hint */}
          <div className="mt-auto pb-8 text-center">
            <p className="text-[9px] text-white/20 uppercase tracking-[0.4em] font-medium">PromptForge Architecture v2.5 (LIVE)</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotificationSidebar;
