import type { Message, ModelOption } from '../types';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8008';

export interface HealthResponse {
  status: string;
  has_server_key: boolean;
  default_model: string;
  default_voice: string;
}

export const checkHealth = async (): Promise<HealthResponse> => {
  const res = await fetch(`${API_BASE_URL}/api/health`);
  if (!res.ok) throw new Error('Backend not reachable');
  return res.json();
};

export const verifyApiKey = async (apiKey?: string): Promise<{ valid: boolean; error?: string }> => {
  const res = await fetch(`${API_BASE_URL}/api/verify-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: apiKey || '' }),
  });
  return res.json();
};

export const fetchModels = async (apiKey?: string): Promise<ModelOption[]> => {
  const url = apiKey ? `${API_BASE_URL}/api/models?key=${encodeURIComponent(apiKey)}` : `${API_BASE_URL}/api/models`;
  const res = await fetch(url);
  const data = await res.json();
  return data.models || [];
};

export const streamChatResponse = async (
  messages: Message[],
  options: {
    model: string;
    systemPrompt: string;
    temperature: number;
    apiKey?: string;
  },
  onChunk: (text: string) => void,
  onError: (err: string) => void,
  onFinish: () => void
) => {
  try {
    const formattedMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      content: m.content
    }));

    const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: formattedMessages,
        model: options.model,
        system_prompt: options.systemPrompt,
        temperature: options.temperature,
        apiKey: options.apiKey || undefined
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errData.detail || 'Failed to stream response');
    }

    if (!response.body) throw new Error('No readable stream returned');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.error) {
              onError(parsed.error);
              return;
            }
            if (parsed.text) {
              onChunk(parsed.text);
            }
            if (parsed.done) {
              onFinish();
              return;
            }
          } catch (e) {
            console.error('Error parsing SSE json:', e);
          }
        }
      }
    }
    onFinish();
  } catch (err: any) {
    onError(err.message || 'Stream connection error');
  }
};

export const sendVoiceTurn = async (
  audioBlob: Blob,
  options: {
    systemPrompt?: string;
    model?: string;
    apiKey?: string;
  }
): Promise<{ text: string }> => {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'mic.webm');
  if (options.systemPrompt) formData.append('system_prompt', options.systemPrompt);
  if (options.model) formData.append('model_name', options.model);
  if (options.apiKey) formData.append('api_key', options.apiKey);

  const res = await fetch(`${API_BASE_URL}/api/voice-turn`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Voice turn failed' }));
    throw new Error(err.detail || 'Voice processing failed');
  }

  return res.json();
};

export const speakTextBrowser = (text: string, voiceName?: string): Promise<void> => {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();

    // Clean markdown before speaking
    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'Code snippet')
      .replace(/[*_#`~[\]()]/g, '')
      .trim();

    if (!cleanText) {
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const selected = voices.find(v => v.name.includes(voiceName || '') || v.lang.startsWith('en'));
      if (selected) utterance.voice = selected;
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.speak(utterance);
  });
};
