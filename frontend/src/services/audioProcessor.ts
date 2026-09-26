// High-precision Audio processing utilities for Gemini Live Voice
// Mic Capture: Native Hardware AudioContext -> Linear Interpolation Resampler -> 16kHz PCM Int16
// AI Playback: 24kHz PCM Int16 -> 24kHz Float32 -> Dedicated Playback Context

export class AudioProcessor {
  private micCtx: AudioContext | null = null;
  private playbackCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private outputAnalyserNode: AnalyserNode | null = null;
  private nextPlayTime: number = 0;
  private isPlayingAudio: boolean = false;

  public initPlaybackContext(): AudioContext {
    if (!this.playbackCtx || this.playbackCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.playbackCtx = new AudioCtxClass({ sampleRate: 24000 });
    }
    if (this.playbackCtx.state === 'suspended') {
      this.playbackCtx.resume();
    }
    return this.playbackCtx;
  }

  public initContext(): AudioContext {
    return this.initPlaybackContext();
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  public getOutputAnalyser(): AnalyserNode | null {
    return this.outputAnalyserNode;
  }

  // Start Mic Capture using native hardware rate, then cleanly downsample to 16kHz
  public async startMicCapture(onPcmChunk: (base64Data: string) => void): Promise<AnalyserNode> {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    // Let browser choose its native hardware sample rate (typically 44.1kHz or 48kHz)
    this.micCtx = new AudioCtxClass();
    if (this.micCtx.state === 'suspended') {
      await this.micCtx.resume();
    }

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    });

    this.sourceNode = this.micCtx.createMediaStreamSource(this.micStream);
    this.analyserNode = this.micCtx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // Buffer size 2048
    this.processorNode = this.micCtx.createScriptProcessor(2048, 1, 1);

    this.sourceNode.connect(this.analyserNode);
    this.analyserNode.connect(this.processorNode);
    this.processorNode.connect(this.micCtx.destination);

    const inSampleRate = this.micCtx.sampleRate;
    const targetSampleRate = 16000;

    this.processorNode.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // High-quality Linear Interpolation Downsampling to 16000 Hz
      const samples16k = this.downsampleTo16kHz(inputData, inSampleRate, targetSampleRate);
      const pcm16 = this.floatTo16BitPCM(samples16k);
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
    if (this.micCtx && this.micCtx.state !== 'closed') {
      this.micCtx.close();
      this.micCtx = null;
    }
  }

  // Play incoming PCM 24kHz Audio chunk smoothly
  public playPcmChunk(base64Data: string) {
    const ctx = this.initPlaybackContext();
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

      // Convert 16-bit PCM (Little-Endian) to Float32
      const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const numSamples = Math.floor(bytes.byteLength / 2);
      if (numSamples === 0) return;

      const float32Array = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        const int16 = dataView.getInt16(i * 2, true);
        float32Array[i] = int16 / 32768.0;
      }

      // Create AudioBuffer (24000 Hz, 1 channel)
      const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAnalyserNode);

      const currentTime = ctx.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime + 0.03;
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
    if (this.playbackCtx) {
      this.nextPlayTime = this.playbackCtx.currentTime;
    }
    this.isPlayingAudio = false;
  }

  public isSpeaking(): boolean {
    return this.isPlayingAudio;
  }

  // Linear interpolation resampler for clear, natural speech transmission
  private downsampleTo16kHz(buffer: Float32Array, inSampleRate: number, outSampleRate: number): Float32Array {
    if (inSampleRate === outSampleRate) {
      return buffer;
    }
    const sampleRateRatio = inSampleRate / outSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
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
    if (this.playbackCtx && this.playbackCtx.state !== 'closed') {
      this.playbackCtx.close();
      this.playbackCtx = null;
    }
  }
}

export const audioProcessor = new AudioProcessor();
