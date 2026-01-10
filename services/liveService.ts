
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { LiveTranscription } from '../types';

export class LiveArchitectSession {
  private ai: any;
  private session: any;
  private audioContextIn: AudioContext | null = null;
  private audioContextOut: AudioContext | null = null;
  private nextStartTime: number = 0;
  private sources: Set<AudioBufferSourceNode> = new Set();
  private frameInterval: number | null = null;
  private stream: MediaStream | null = null;
  private onTranscription: (t: LiveTranscription) => void;
  private onStatusChange: (status: string) => void;

  // State to manage continuous transcriptions per turn
  private currentInputId: string | null = null;
  private currentOutputId: string | null = null;
  private currentInputText: string = '';
  private currentOutputText: string = '';

  constructor(onTranscription: (t: LiveTranscription) => void, onStatusChange: (status: string) => void) {
    this.onTranscription = onTranscription;
    this.onStatusChange = onStatusChange;
  }

  async start(displayStream: MediaStream) {
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === "undefined") {
      throw new Error("API key is missing. Please connect your API key first.");
    }

    this.ai = new GoogleGenAI({ apiKey });
    
    try {
      this.audioContextIn = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.audioContextOut = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
    } catch (err: any) {
      console.error("Hardware access error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.toLowerCase().includes('denied')) {
        throw new Error("Microphone access was denied. To use Live Audit, please enable microphone permissions in your browser settings.");
      }
      throw new Error("Could not access microphone.");
    }

    this.onStatusChange('Connecting to Gemini...');

    try {
      const sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            this.onStatusChange('Connected');
            this.startAudioStreaming(sessionPromise);
            this.startScreenStreaming(displayStream, sessionPromise);
          },
          onmessage: async (message: LiveServerMessage) => {
            this.handleMessage(message);
          },
          onerror: (e: any) => {
            console.error("Live session error:", e);
            const errorMessage = e?.message || "Connection failed.";
            this.onStatusChange(`Error: ${errorMessage}`);
          },
          onclose: () => {
            this.onStatusChange('Disconnected');
            this.stop();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
          },
          systemInstruction: `You are a Senior UI Architect. You are watching the user's screen live. 
          Analyze the design, UI elements, and layout visible in the video frames. 
          Respond conversationally via VOICE. Answer user questions technical issues. 
          Keep your responses relatively brief but insightful.`
        }
      });

      this.session = await sessionPromise;
    } catch (err: any) {
      console.error("Failed to establish Live connection:", err);
      this.onStatusChange('Network Error');
      throw new Error("Network error occurred while connecting to the AI Architect.");
    }
  }

  private handleMessage(message: LiveServerMessage) {
    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (base64Audio && this.audioContextOut) {
      this.playAudio(base64Audio);
    }

    // Handle Input Transcription (User)
    if (message.serverContent?.inputTranscription) {
      if (!this.currentInputId) {
        this.currentInputId = "user-" + Date.now();
      }
      this.currentInputText += message.serverContent.inputTranscription.text;
      this.onTranscription({
        id: this.currentInputId,
        role: 'user',
        text: this.currentInputText,
        timestamp: Date.now()
      });
    }

    // Handle Output Transcription (Model)
    if (message.serverContent?.outputTranscription) {
      if (!this.currentOutputId) {
        this.currentOutputId = "model-" + Date.now();
      }
      this.currentOutputText += message.serverContent.outputTranscription.text;
      this.onTranscription({
        id: this.currentOutputId,
        role: 'model',
        text: this.currentOutputText,
        timestamp: Date.now()
      });
    }

    // Reset turn state when the interaction finishes
    if (message.serverContent?.turnComplete) {
      this.currentInputId = null;
      this.currentOutputId = null;
      this.currentInputText = '';
      this.currentOutputText = '';
    }

    if (message.serverContent?.interrupted) {
      this.sources.forEach(s => { try { s.stop(); } catch(e) {} });
      this.sources.clear();
      this.nextStartTime = 0;
      // Reset text on interruption
      this.currentOutputText = '';
      this.currentOutputId = null;
    }
  }

  private async playAudio(base64: string) {
    if (!this.audioContextOut) return;
    try {
      this.nextStartTime = Math.max(this.nextStartTime, this.audioContextOut.currentTime);
      const audioBuffer = await this.decodeAudioData(this.decodeBase64(base64), this.audioContextOut, 24000, 1);
      const source = this.audioContextOut.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContextOut.destination);
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.sources.add(source);
      source.onended = () => this.sources.delete(source);
    } catch (e) {
      console.error("Audio playback error:", e);
    }
  }

  private startAudioStreaming(sessionPromise: Promise<any>) {
    if (!this.stream || !this.audioContextIn) return;
    const source = this.audioContextIn.createMediaStreamSource(this.stream);
    const scriptProcessor = this.audioContextIn.createScriptProcessor(4096, 1, 1);
    scriptProcessor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = this.createPcmBlob(inputData);
      sessionPromise.then(s => {
        try { s.sendRealtimeInput({ media: pcmBlob }); } catch(err) {}
      });
    };
    source.connect(scriptProcessor);
    scriptProcessor.connect(this.audioContextIn.destination);
  }

  private startScreenStreaming(displayStream: MediaStream, sessionPromise: Promise<any>) {
    const video = document.createElement('video');
    video.srcObject = displayStream;
    video.muted = true;
    video.play().catch(e => console.error(e));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    this.frameInterval = window.setInterval(() => {
      if (!ctx || video.paused || video.ended || video.readyState < 2) return;
      
      const scale = 640 / video.videoWidth;
      canvas.width = 640;
      canvas.height = video.videoHeight * scale;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
      
      sessionPromise.then(s => {
        try { s.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } }); } catch(err) {}
      });
    }, 1500);
  }

  private createPcmBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: this.encodeBase64(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  }

  private decodeBase64(base64: string) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private encodeBase64(bytes: Uint8Array) {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private async decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  stop() {
    if (this.frameInterval) clearInterval(this.frameInterval);
    if (this.session) { try { this.session.close(); } catch(e) {} }
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.sources.forEach(s => { try { s.stop(); } catch(e) {} });
    this.sources.clear();
    this.onStatusChange('Disconnected');
  }
}
