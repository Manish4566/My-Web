
import React, { useRef } from 'react';
import { PlayCircle, Upload, Film, Loader2 } from 'lucide-react';

interface UploadCircleProps {
  onFileSelect: (file: File) => void;
  isAnalyzing: boolean;
  videoLoaded: boolean;
}

const UploadCircle: React.FC<UploadCircleProps> = ({ onFileSelect, isAnalyzing, videoLoaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!isAnalyzing) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className="relative group flex flex-col items-center">
      <div 
        onClick={handleClick}
        className={`w-64 h-64 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-700 relative overflow-hidden ${
          isAnalyzing 
            ? 'scale-105 border-blue-500/50 shadow-[0_0_60px_rgba(59,130,246,0.2)]' 
            : 'border-white/10 hover:border-blue-500/50 hover:shadow-[0_0_40px_rgba(59,130,246,0.2)]'
        } border-2 bg-gradient-to-br from-[#111] to-[#050505]`}
      >
        {/* Animated background rings when analyzing */}
        {isAnalyzing && (
          <div className="absolute inset-0 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        )}

        <div className="z-10 flex flex-col items-center text-center px-6">
          {isAnalyzing ? (
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
          ) : videoLoaded ? (
            <Film className="w-12 h-12 text-blue-400 mb-4" />
          ) : (
            <Upload className="w-12 h-12 text-white/40 group-hover:text-white transition-colors mb-4" />
          )}
          
          <span className="text-sm font-medium text-white/60 group-hover:text-white transition-colors">
            {isAnalyzing 
              ? 'Analyzing Site Architecture...' 
              : videoLoaded 
                ? 'Recording Uploaded' 
                : 'Upload Website Screen Recording'}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-white/20 mt-2">
            MP4 / WebM only
          </span>
        </div>
      </div>
      
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="video/*" 
        className="hidden" 
      />
    </div>
  );
};

export default UploadCircle;
