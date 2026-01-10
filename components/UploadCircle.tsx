
import React, { useRef, useEffect } from 'react';
import { Upload, Film, Loader2, Image as ImageIcon, FileText, Monitor, Mic } from 'lucide-react';
import { UploadMode } from '../types';

interface UploadCircleProps {
  onFileSelect: (file: File) => void;
  isAnalyzing: boolean;
  hasLoaded: boolean;
  mode: UploadMode;
  liveStream?: MediaStream | null;
}

const UploadCircle: React.FC<UploadCircleProps> = ({ onFileSelect, isAnalyzing, hasLoaded, mode, liveStream }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && liveStream) {
      videoRef.current.srcObject = liveStream;
    }
  }, [liveStream]);

  const handleClick = () => {
    if (!isAnalyzing && mode !== 'live') {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const getAccept = () => {
    switch (mode) {
      case 'image': return 'image/*';
      case 'pdf': return 'application/pdf';
      case 'video':
      default: return 'video/*';
    }
  };

  const getIcon = () => {
    if (mode === 'live' && liveStream) return null;
    if (isAnalyzing) return <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />;
    
    if (hasLoaded) {
      switch (mode) {
        case 'image': return <ImageIcon className="w-12 h-12 text-blue-400 mb-4" />;
        case 'pdf': return <FileText className="w-12 h-12 text-blue-400 mb-4" />;
        default: return <Film className="w-12 h-12 text-blue-400 mb-4" />;
      }
    }
    
    switch (mode) {
      case 'image': return <ImageIcon className="w-12 h-12 text-white/40 group-hover:text-white transition-colors mb-4" />;
      case 'pdf': return <FileText className="w-12 h-12 text-white/40 group-hover:text-white transition-colors mb-4" />;
      case 'screen': return <Monitor className="w-12 h-12 text-white/40 group-hover:text-white transition-colors mb-4" />;
      case 'live': return <Mic className="w-12 h-12 text-blue-500 animate-pulse mb-4" />;
      default: return <Upload className="w-12 h-12 text-white/40 group-hover:text-white transition-colors mb-4" />;
    }
  };

  const getLabel = () => {
    if (mode === 'live' && liveStream) return 'LIVE AUDIT ACTIVE';
    if (isAnalyzing) return 'Analyzing Architecture...';
    if (hasLoaded) return 'Analysis Context Ready';
    switch (mode) {
      case 'live': return 'Starting Live Session...';
      case 'image': return 'Upload UI Screenshot';
      case 'pdf': return 'Upload Design (PDF)';
      case 'screen': return 'Ready for Screen Capture';
      default: return 'Upload Screen Recording';
    }
  };

  return (
    <div className="relative group flex flex-col items-center">
      <div 
        onClick={handleClick}
        className={`w-64 h-64 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-700 relative overflow-hidden ${
          isAnalyzing || (mode === 'live' && liveStream)
            ? 'scale-105 border-blue-500/50 shadow-[0_0_80px_rgba(59,130,246,0.3)]' 
            : 'border-white/10 hover:border-blue-500/50 hover:shadow-[0_0_40px_rgba(59,130,246,0.2)]'
        } border-2 bg-gradient-to-br from-[#111] to-[#050505]`}
      >
        {mode === 'live' && liveStream && (
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline 
            className="absolute inset-0 w-full h-full object-cover opacity-80"
          />
        )}

        {isAnalyzing && (
          <div className="absolute inset-0 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        )}

        <div className={`z-10 flex flex-col items-center text-center px-6 ${mode === 'live' && liveStream ? 'bg-black/40 backdrop-blur-sm p-4 rounded-full' : ''}`}>
          {getIcon()}
          
          <span className={`text-sm font-black transition-colors uppercase tracking-widest ${mode === 'live' ? 'text-blue-400' : 'text-white/60 group-hover:text-white'}`}>
            {getLabel()}
          </span>
          {mode !== 'live' && (
            <span className="text-[10px] uppercase tracking-widest text-white/20 mt-2">
              {mode === 'image' ? 'PNG / JPEG' : 'Video/PDF Source'}
            </span>
          )}
        </div>
      </div>
      
      {mode !== 'screen' && mode !== 'live' && (
        <input 
          type="file" 
          key={mode}
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept={getAccept()} 
          className="hidden" 
        />
      )}
    </div>
  );
};

export default UploadCircle;
