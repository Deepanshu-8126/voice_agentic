// Gemini Live WebSocket Client Manager

export interface LiveClientCallbacks {
  onAudioData: (base64Audio: string, mimeType?: string) => void;
  onTextData: (text: string) => void;
  onUserTextData?: (text: string) => void;
  onAgentAction?: (action: { tool: string; args?: any; result?: any; status: 'executing' | 'completed' }) => void;
  onTurnComplete: () => void;
  onInterrupted: () => void;
  onError: (error: string) => void;
  onConnected: () => void;
  onDisconnected: () => void;
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private callbacks: LiveClientCallbacks | null = null;
  private isConnected: boolean = false;

  public connect(
    config: {
      apiKey: string;
      voice: string;
      model?: string;
      systemPrompt?: string;
    },
    callbacks: LiveClientCallbacks
  ) {
    this.callbacks = callbacks;
    this.disconnect();

    const params = new URLSearchParams({
      apiKey: config.apiKey,
      voice: config.voice || 'Aoede',
      model: config.model || 'models/gemini-3.1-flash-live-preview',
      system_prompt: config.systemPrompt || 'You are an intelligent, low-latency, warm conversational voice assistant.'
    });

    const defaultWs = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8008')
      .replace(/^http:\/\//, 'ws://')
      .replace(/^https:\/\//, 'wss://');
    const baseWsUrl = import.meta.env.VITE_WS_BASE_URL || defaultWs;
    const wsUrl = `${baseWsUrl}/ws/live?${params.toString()}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Gemini Live WS connected to backend');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connected') {
            this.isConnected = true;
            this.callbacks?.onConnected();
          } else if (data.type === 'audio') {
            this.callbacks?.onAudioData(data.data, data.mimeType);
          } else if (data.type === 'text') {
            this.callbacks?.onTextData(data.text);
          } else if (data.type === 'userText') {
            this.callbacks?.onUserTextData?.(data.text);
          } else if (data.type === 'agentAction') {
            this.callbacks?.onAgentAction?.(data);
          } else if (data.type === 'turnComplete') {
            this.callbacks?.onTurnComplete();
          } else if (data.type === 'interrupted') {
            this.callbacks?.onInterrupted();
          } else if (data.type === 'error') {
            this.callbacks?.onError(data.message || 'WebSocket Error');
          }
        } catch (e) {
          console.error('Error parsing live WS message:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.error('Gemini Live WS error:', err);
        this.callbacks?.onError('Failed to connect to Live Voice server');
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.callbacks?.onDisconnected();
      };
    } catch (err: any) {
      callbacks.onError(err.message || 'Failed to initialize WebSocket');
    }
  }

  public sendAudioChunk(base64Pcm: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'audio',
        data: base64Pcm
      }));
    }
  }

  public sendText(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'text',
        text: text
      }));
    }
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  public active(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

export const liveClient = new GeminiLiveClient();
