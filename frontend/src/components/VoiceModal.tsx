import React, { useEffect, useState, useRef } from 'react';
import { 
  X, Mic, MicOff, Volume2, VolumeX, PhoneOff, 
  Sparkles, Radio, Layers, Activity, Zap, Clock, User, Bot
} from 'lucide-react';
import { VoiceVisualizer } from './VoiceVisualizer';
import { audioProcessor } from '../services/audioProcessor';
import { liveClient } from '../services/geminiLiveClient';
import type { AppSettings } from '../types';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onTranscriptReceived?: (userText: string, aiText: string) => void;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  settings,
  onTranscriptReceived
}) => {
  const [status, setStatus] = useState<'idle' | 'listening' | 'speaking' | 'processing' | 'error'>('idle');
  const [selectedVoice, setSelectedVoice] = useState(settings.selectedVoice || 'Aoede');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [visualMode, setVisualMode] = useState<'orb' | 'wave'>('orb');
  const [liveUserText, setLiveUserText] = useState('');
  const [liveAiText, setLiveAiText] = useState('');
  const [transcriptHistory, setTranscriptHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string; time: string }>>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [micVolume, setMicVolume] = useState<number>(0);
  const [speakerVolume, setSpeakerVolume] = useState<number>(0);

  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [outputAnalyser, setOutputAnalyser] = useState<AnalyserNode | null>(null);

  const isMutedRef = useRef(false);
  const currentAiTextRef = useRef('');
  const currentUserTextRef = useRef('');
  const captionsEndRef = useRef<HTMLDivElement>(null);

  const voices = [
    { id: 'Aoede', name: 'Aoede (Warm & Clear, Female)' },
    { id: 'Puck', name: 'Puck (Playful & Quick, Male)' },
    { id: 'Charon', name: 'Charon (Deep & Calm, Male)' },
    { id: 'Kore', name: 'Kore (Gentle & Smooth, Female)' },
    { id: 'Fenrir', name: 'Fenrir (Direct & Confident, Male)' }
  ];

  // Auto scroll captions
  useEffect(() => {
    captionsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveUserText, liveAiText, transcriptHistory]);

  // Duration timer
  useEffect(() => {
    let timer: any;
    if (isOpen) {
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [isOpen]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getCurrentTimestamp = () => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Real-time VU meter listener
  useEffect(() => {
    let animId: number;
    const updateLevels = () => {
      const dataArr = new Uint8Array(128);

      if (analyser && !isMutedRef.current) {
        analyser.getByteFrequencyData(dataArr);
        let sum = 0;
        for (let i = 0; i < dataArr.length; i++) {
          sum += dataArr[i];
        }
        const avg = sum / dataArr.length;
        const pct = Math.min(100, Math.round((avg / 128) * 100));
        setMicVolume(pct);
      } else {
        setMicVolume(0);
      }

      if (outputAnalyser) {
        outputAnalyser.getByteFrequencyData(dataArr);
        let sum = 0;
        for (let i = 0; i < dataArr.length; i++) {
          sum += dataArr[i];
        }
        const avg = sum / dataArr.length;
        const pct = Math.min(100, Math.round((avg / 128) * 100));
        setSpeakerVolume(pct);
      } else {
        setSpeakerVolume(0);
      }

      animId = requestAnimationFrame(updateLevels);
    };

    if (isOpen) {
      animId = requestAnimationFrame(updateLevels);
    }

    return () => cancelAnimationFrame(animId);
  }, [analyser, outputAnalyser, isOpen]);

  // Start voice session when modal opens
  useEffect(() => {
    if (!isOpen) {
      stopVoiceSession();
      return;
    }

    startVoiceSession();

    return () => {
      stopVoiceSession();
    };
  }, [isOpen, selectedVoice]);

  const startVoiceSession = async () => {
    setErrorMessage(null);
    setStatus('processing');
    setLiveAiText('');
    setLiveUserText('');
    currentAiTextRef.current = '';
    currentUserTextRef.current = '';

    try {
      const audioCtx = audioProcessor.initContext();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const micAnalyser = await audioProcessor.startMicCapture((base64Pcm) => {
        if (!isMutedRef.current && liveClient.active()) {
          // If user starts speaking while AI was talking, immediately stop old audio playback (Instant Barge-in)
          if (audioProcessor.isSpeaking()) {
            audioProcessor.resetPlayback();
          }
          liveClient.sendAudioChunk(base64Pcm);
        }
      });
      setAnalyser(micAnalyser);
      setOutputAnalyser(audioProcessor.getOutputAnalyser());

      liveClient.connect(
        {
          apiKey: settings.apiKey,
          voice: selectedVoice,
          model: 'models/gemini-3.1-flash-live-preview',
          systemPrompt: settings.systemPrompt || 'You are an intelligent, low-latency, warm conversational voice assistant. Keep answers natural and concise.'
        },
        {
          onConnected: () => {
            setStatus('listening');
          },
          onAudioData: (base64Audio) => {
            setStatus('speaking');
            audioProcessor.playPcmChunk(base64Audio);
          },
          onTextData: (text) => {
            currentAiTextRef.current += text;
            setLiveAiText(currentAiTextRef.current);
          },
          onUserTextData: (text) => {
            currentUserTextRef.current += text;
            setLiveUserText(currentUserTextRef.current);
          },
          onTurnComplete: () => {
            const finalAi = currentAiTextRef.current.trim();
            const finalUser = currentUserTextRef.current.trim();

            if (finalUser) {
              setTranscriptHistory(prev => [...prev, { role: 'user', text: finalUser, time: getCurrentTimestamp() }]);
            }
            if (finalAi) {
              setTranscriptHistory(prev => [...prev, { role: 'assistant', text: finalAi, time: getCurrentTimestamp() }]);
            }

            if (onTranscriptReceived && (finalUser || finalAi)) {
              onTranscriptReceived(finalUser, finalAi);
            }

            currentAiTextRef.current = '';
            currentUserTextRef.current = '';
            setLiveAiText('');
            setLiveUserText('');
            setStatus('listening');
          },
          onInterrupted: () => {
            audioProcessor.resetPlayback();
            currentAiTextRef.current = '';
            currentUserTextRef.current = '';
            setLiveAiText('');
            setLiveUserText('');
            setStatus('listening');
          },
          onError: (err) => {
            setErrorMessage(err);
            setStatus('error');
          },
          onDisconnected: () => {
            setStatus('idle');
          }
        }
      );

    } catch (err: any) {
      console.error('Failed to start voice call:', err);
      setErrorMessage(err.message || 'Microphone access denied or audio device not ready');
      setStatus('error');
    }
  };

  const stopVoiceSession = () => {
    liveClient.disconnect();
    audioProcessor.destroy();
    setAnalyser(null);
    setOutputAnalyser(null);
    setStatus('idle');
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    isMutedRef.current = next;
  };

  const toggleSpeaker = () => {
    setIsSpeakerMuted(!isSpeakerMuted);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/90 backdrop-blur-2xl animate-fade-in">
      {/* Background ambient neon glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />

      {/* Main Glass Modal Card */}
      <div className="relative flex flex-col items-center justify-between w-full max-w-5xl h-[92vh] max-h-[900px] p-4 md:p-6 rounded-[2.5rem] bg-dark-900/80 border border-white/10 shadow-[0_0_80px_rgba(147,51,234,0.15)] backdrop-blur-3xl overflow-hidden">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between w-full pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-3.5">
            <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 text-white shadow-lg shadow-purple-500/25">
              <Radio className="w-5 h-5 animate-pulse" />
              <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-bold text-white tracking-tight">
                  Gemini Live Voice Studio
                </h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <Zap className="w-3 h-3" />
                  Live WS Active
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                <span className="flex items-center gap-1 font-mono text-gray-300">
                  <Clock className="w-3 h-3 text-gray-400" />
                  {formatTime(callDuration)}
                </span>
                <span>•</span>
                <span className="capitalize font-semibold text-gray-200">
                  {status === 'speaking' ? '✨ Gemini is Speaking...' :
                   status === 'listening' ? (isMuted ? '🔇 Microphone Muted' : (micVolume > 5 ? '🎙️ Hearing your Voice!' : '👂 Listening for speech...')) :
                   status === 'processing' ? '⚡ Connecting WebSocket...' :
                   status === 'error' ? '⚠️ Error' : 'Ready'}
                </span>
              </div>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2.5">
            {/* Voice Selector */}
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="bg-dark-800/90 text-gray-200 text-xs font-medium px-3.5 py-2 rounded-xl border border-white/10 hover:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer shadow-sm transition-all"
            >
              {voices.map(v => (
                <option key={v.id} value={v.id} className="bg-dark-900 text-gray-200">
                  {v.name}
                </option>
              ))}
            </select>

            {/* Visualizer Mode switch */}
            <button
              onClick={() => setVisualMode(visualMode === 'orb' ? 'wave' : 'orb')}
              title={`Switch to ${visualMode === 'orb' ? 'Waveform' : '3D Orb'} visualizer`}
              className="p-2.5 rounded-xl bg-dark-800/90 hover:bg-dark-750 text-gray-300 hover:text-white transition-colors border border-white/10 shadow-sm"
            >
              {visualMode === 'orb' ? <Activity className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-dark-800/90 hover:bg-dark-750 text-gray-400 hover:text-white transition-colors border border-white/10 shadow-sm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Mic & Speaker VU Status Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 w-full mt-3 px-5 py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-md">
          <div className="flex items-center gap-6">
            {/* User Mic Live Meter */}
            <div className="flex items-center gap-2 text-xs">
              <Mic className={`w-3.5 h-3.5 ${micVolume > 5 ? 'text-emerald-400 animate-bounce' : 'text-gray-500'}`} />
              <span className="text-gray-400 font-mono text-[11px]">Mic Input:</span>
              <div className="w-24 h-2 bg-dark-950 rounded-full overflow-hidden border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-75 rounded-full"
                  style={{ width: `${micVolume}%` }}
                />
              </div>
              <span className={`font-mono text-[10px] w-7 ${micVolume > 5 ? 'text-emerald-400 font-bold' : 'text-gray-500'}`}>
                {micVolume}%
              </span>
            </div>

            <span className="hidden sm:inline text-gray-700">|</span>

            {/* AI Speaker Live Meter */}
            <div className="flex items-center gap-2 text-xs">
              <Volume2 className={`w-3.5 h-3.5 ${speakerVolume > 5 ? 'text-purple-400 animate-pulse' : 'text-gray-500'}`} />
              <span className="text-gray-400 font-mono text-[11px]">AI Speaker:</span>
              <div className="w-24 h-2 bg-dark-950 rounded-full overflow-hidden border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-75 rounded-full"
                  style={{ width: `${speakerVolume}%` }}
                />
              </div>
              <span className={`font-mono text-[10px] w-7 ${speakerVolume > 5 ? 'text-purple-400 font-bold' : 'text-gray-500'}`}>
                {speakerVolume}%
              </span>
            </div>
          </div>

          {/* Test Speaker Button */}
          <button
            onClick={() => {
              const ctx = audioProcessor.initPlaybackContext();
              ctx.resume();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(440, ctx.currentTime);
              gain.gain.setValueAtTime(0.1, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.4);
            }}
            className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-1 rounded-xl border border-cyan-500/30 transition-all shadow-sm"
          >
            🔊 Test Speaker
          </button>
        </div>

        {/* Center Grid: 3D Orb Visualizer + Live Captions Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full flex-1 min-h-0 my-3 items-center">
          
          {/* Left: 3D Organic Visualizer */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center h-full">
            <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center animate-subtle-float">
              <VoiceVisualizer
                analyser={analyser}
                outputAnalyser={outputAnalyser}
                isActive={status !== 'idle' && status !== 'error'}
                status={status}
                mode={visualMode}
              />
            </div>
          </div>

          {/* Right: Live Interactive Subtitle & Captions Container */}
          <div className="lg:col-span-6 flex flex-col h-full max-h-[360px] md:max-h-[420px] rounded-3xl bg-dark-950/70 border border-white/[0.08] backdrop-blur-xl p-4 shadow-2xl overflow-hidden">
            
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Live Captions & Dialogue</span>
              </div>
              <span className="text-[10px] text-gray-500 font-mono">Real-time Stream</span>
            </div>

            {/* Scrollable Transcript Dialogue Area */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/10">
              {transcriptHistory.map((item, idx) => (
                <div 
                  key={idx} 
                  className={`flex flex-col p-3 rounded-2xl transition-all ${
                    item.role === 'user' 
                      ? 'bg-purple-950/30 border border-purple-500/20 ml-4' 
                      : 'bg-white/[0.04] border border-white/[0.08] mr-4'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] font-bold flex items-center gap-1.5 ${item.role === 'user' ? 'text-purple-400' : 'text-cyan-400'}`}>
                      {item.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                      {item.role === 'user' ? 'You' : 'Gemini AI'}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">{item.time}</span>
                  </div>
                  <p className="text-xs md:text-sm text-gray-200 leading-relaxed">
                    {item.text}
                  </p>
                </div>
              ))}

              {/* Live Streaming User Speech Delta */}
              {liveUserText && (
                <div className="flex flex-col p-3 rounded-2xl bg-purple-900/30 border border-purple-400/40 ml-4 animate-pulse">
                  <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5 mb-1">
                    <User className="w-3 h-3" /> You (Speaking...)
                  </span>
                  <p className="text-xs md:text-sm text-purple-100 font-medium">
                    {liveUserText}
                  </p>
                </div>
              )}

              {/* Live Streaming AI Speech Delta */}
              {liveAiText && (
                <div className="flex flex-col p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 mr-4 animate-pulse">
                  <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5 mb-1">
                    <Bot className="w-3 h-3" /> Gemini AI (Speaking...)
                  </span>
                  <p className="text-xs md:text-sm text-cyan-100 font-medium">
                    {liveAiText}
                  </p>
                </div>
              )}

              {/* Empty State Prompt */}
              {transcriptHistory.length === 0 && !liveUserText && !liveAiText && (
                <div className="flex flex-col items-center justify-center h-full text-center py-10 px-4 text-gray-400">
                  <Sparkles className="w-7 h-7 text-purple-400/60 mb-2 animate-bounce" />
                  <p className="text-xs md:text-sm font-medium text-gray-300">Start talking into your microphone</p>
                  <p className="text-[11px] text-gray-500 mt-1">Live subtitles and AI responses will stream here in real-time.</p>
                </div>
              )}

              <div ref={captionsEndRef} />
            </div>

            {/* Error banner if any */}
            {errorMessage && (
              <div className="mt-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <span>⚠️ {errorMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Call Controls Bar */}
        <div className="flex items-center justify-center gap-6 w-full pt-3 border-t border-white/[0.06]">
          {/* Mute Mic Button */}
          <button
            onClick={toggleMute}
            className={`flex flex-col items-center gap-1 px-5 py-3 rounded-2xl transition-all duration-200 shadow-xl ${
              isMuted
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-dark-800 hover:bg-dark-750 text-gray-200 border border-white/10 hover:border-white/20'
            }`}
            title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            <span className="text-[10px] font-medium">{isMuted ? 'Unmute' : 'Mute Mic'}</span>
          </button>

          {/* End Call Button */}
          <button
            onClick={onClose}
            className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-2xl shadow-rose-600/40 transition-all hover:scale-105 active:scale-95 border border-rose-400/30"
            title="End Voice Session"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          {/* Speaker Mute Button */}
          <button
            onClick={toggleSpeaker}
            className={`flex flex-col items-center gap-1 px-5 py-3 rounded-2xl transition-all duration-200 shadow-xl ${
              isSpeakerMuted
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-dark-800 hover:bg-dark-750 text-gray-200 border border-white/10 hover:border-white/20'
            }`}
            title={isSpeakerMuted ? 'Unmute Speaker' : 'Mute Speaker'}
          >
            {isSpeakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            <span className="text-[10px] font-medium">{isSpeakerMuted ? 'Unmuted' : 'Speaker'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
