
export interface AnalysisResult {
  pages: string[];
  elements: {
    type: string;
    description: string;
    canEdit: boolean;
  }[];
  reasoning: string[];
}

export interface FinalPrompt {
  content: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  userName?: string; // User who generated this
  videoUrl?: string; // Reference to the video
  instructions: string;
  analysis: AnalysisResult;
  prompt: FinalPrompt;
}

export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  READY_FOR_PROMPT = 'READY_FOR_PROMPT',
  GENERATING_PROMPT = 'GENERATING_PROMPT',
  COMPLETED = 'COMPLETED'
}

export type ModalType = 'history' | 'signup' | 'upgrade' | null;
