
export interface AnalysisResult {
  pages: string[];
  elements: {
    type: string;
    description: string;
    canEdit: boolean;
  }[];
  reasoning: string[];
  spokenIntent?: string;
}

export interface FinalPrompt {
  content: string;
}

export interface UserProfile {
  name: string;
  email: string;
  isPro: boolean;
  subscriptionExpiry?: number;
  paidAmount?: string;
  currency?: string;
  txnId?: string;
  lastLogin: number;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  userName?: string;
  videoUrl?: string;
  instructions: string;
  analysis: AnalysisResult;
  prompt: FinalPrompt;
}

export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  READY_FOR_PROMPT = 'READY_FOR_PROMPT',
  GENERATING_PROMPT = 'GENERATING_PROMPT',
  COMPLETED = 'COMPLETED',
  LIVE = 'LIVE'
}

export interface LiveTranscription {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export type ModalType = 'history' | 'signup' | 'upgrade' | 'payment' | null;

export type UploadMode = 'video' | 'image' | 'pdf' | 'screen' | 'live';
