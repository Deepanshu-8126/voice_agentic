// Audio processing utilities for PCM 16kHz Mic capture and PCM 24kHz Live playback

export class AudioProcessor {
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private outputAnalyserNode: AnalyserNode | null = null;
  private nextPlayTime: number = 0;
  private isPlayingAudio: boolean = false;

  public initContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass({ sampleRate: 24000 });
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  public getOutputAnalyser(): AnalyserNode | null {
    return this.outputAnalyserNode;
  }

  // Start Mic Capture at 16kHz PCM
  public async startMicCapture(onPcmChunk: (base64Data: string) => void): Promise<AnalyserNode> {
    const ctx = this.initContext();

    // High quality microphone constraints with noise suppression and echo cancellation
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    });

    this.sourceNode = ctx.createMediaStreamSource(this.micStream);
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // Buffer size 2048 or 4096 (low latency)
    this.processorNode = ctx.createScriptProcessor(2048, 1, 1);

    this.sourceNode.connect(this.analyserNode);
    this.analyserNode.connect(this.processorNode);
    this.processorNode.connect(ctx.destination);

    this.processorNode.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Resample / downsample to 16000 Hz PCM Int16
      const pcm16 = this.floatTo16BitPCM(inputData);
      const base64Chunk = this.arrayBufferToBase64(pcm16.buffer as ArrayBuffer);
      onPcmChunk(base64Chunk);
    };

    return this.analyserNode;
  }

  public stopMicCapture() {
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
  }

  // Play incoming PCM 24kHz Audio chunk smoothly
  public playPcmChunk(base64Data: string) {
    const ctx = this.initContext();
    if (!this.outputAnalyserNode) {
      this.outputAnalyserNode = ctx.createAnalyser();
      this.outputAnalyserNode.fftSize = 256;
      this.outputAnalyserNode.smoothingTimeConstant = 0.8;
      this.outputAnalyserNode.connect(ctx.destination);
    }

    try {
      const binaryStr = atob(base64Data);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // Convert 16-bit PCM (signed Int16) to Float32
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      // Create AudioBuffer (24000 Hz, 1 channel)
      const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAnalyserNode);

      const currentTime = ctx.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime + 0.05; // small jitter buffer
      }

      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
      this.isPlayingAudio = true;

      source.onended = () => {
        if (ctx.currentTime >= this.nextPlayTime - 0.02) {
          this.isPlayingAudio = false;
        }
      };
    } catch (e) {
      console.error("Failed to decode and play PCM chunk:", e);
    }
  }

  public resetPlayback() {
    if (this.audioCtx) {
      this.nextPlayTime = this.audioCtx.currentTime;
    }
    this.isPlayingAudio = false;
  }

  public isSpeaking(): boolean {
    return this.isPlayingAudio;
  }

  // Convert Float32 to Int16 PCM
  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  public destroy() {
    this.stopMicCapture();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}

export const audioProcessor = new AudioProcessor();
