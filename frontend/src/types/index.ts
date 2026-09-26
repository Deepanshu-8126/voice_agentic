export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  model: string;
}

export interface ModelOption {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface AppSettings {
  apiKey: string;
  selectedModel: string;
  selectedVoice: string;
  systemPrompt: string;
  temperature: number;
  voiceMode: 'live_ws' | 'turn_based';
  autoSpeak: boolean;
}

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';
