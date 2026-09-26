import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Radio,
  Sparkles,
  Activity,
  Layers,
  X,
  Clock,
  Zap
} from 'lucide-react';
import { VoiceVisualizer } from './VoiceVisualizer';
import { audioProcessor } from '../services/audioProcessor';
import { liveClient } from '../services/geminiLiveClient';
import type { AppSettings, VoiceStatus } from '../types';

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
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [visualMode, setVisualMode] = useState<'orb' | 'wave'>('orb');
  const [selectedVoice, setSelectedVoice] = useState(settings.selectedVoice || 'Aoede');
  const [callDuration, setCallDuration] = useState(0);
  
  // Real-time Mic Level (0 - 100%) to prove microphone is actively hearing the user!
  const [micVolume, setMicVolume] = useState<number>(0);
  const [speakerVolume, setSpeakerVolume] = useState<number>(0);

  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [outputAnalyser, setOutputAnalyser] = useState<AnalyserNode | null>(null);

  const [liveUserText] = useState('');
  const [liveAiText, setLiveAiText] = useState('');
  const [transcriptHistory, setTranscriptHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const currentAiTextRef = useRef('');

  // Call duration counter
  useEffect(() => {
    let timer: any;
    if (isOpen && status !== 'idle' && status !== 'error') {
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [isOpen, status]);

  // Live VU Meter poll to show real-time mic volume %
  useEffect(() => {
    let animId: number;
    const dataArr = new Uint8Array(64);

    const updateLevels = () => {
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
    currentAiTextRef.current = '';

    try {
      const micAnalyser = await audioProcessor.startMicCapture((base64Pcm) => {
        if (!isMutedRef.current && liveClient.active()) {
          liveClient.sendAudioChunk(base64Pcm);
        }
      });
      setAnalyser(micAnalyser);
      setOutputAnalyser(audioProcessor.getOutputAnalyser());

      liveClient.connect(
        {
          apiKey: settings.apiKey,
          voice: selectedVoice,
          model: 'models/gemini-2.0-flash-exp',
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
          onTurnComplete: () => {
            if (currentAiTextRef.current.trim()) {
              const fullText = currentAiTextRef.current.trim();
              setTranscriptHistory(prev => [...prev, { role: 'assistant', text: fullText }]);
              if (onTranscriptReceived) {
                onTranscriptReceived(liveUserText, fullText);
              }
            }
            currentAiTextRef.current = '';
            setLiveAiText('');
            setStatus('listening');
          },
          onInterrupted: () => {
            audioProcessor.resetPlayback();
            currentAiTextRef.current = '';
            setLiveAiText('');
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
      console.error('Failed to start voice session:', err);
      setErrorMessage(err.message || 'Microphone access denied or audio initialization failed');
      setStatus('error');
    }
  };

  const stopVoiceSession = () => {
    liveClient.disconnect();
    audioProcessor.stopMicCapture();
    audioProcessor.resetPlayback();
    setAnalyser(null);
    setOutputAnalyser(null);
    setStatus('idle');
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleSpeaker = () => {
    setIsSpeakerMuted(!isSpeakerMuted);
    if (!isSpeakerMuted) {
      audioProcessor.resetPlayback();
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const voices = [
    { id: 'Aoede', name: 'Aoede (Warm & Natural)', gender: 'Female' },
    { id: 'Puck', name: 'Puck (Playful & Clear)', gender: 'Male' },
    { id: 'Charon', name: 'Charon (Deep & Calm)', gender: 'Male' },
    { id: 'Fenrir', name: 'Fenrir (Energetic)', gender: 'Male' },
    { id: 'Kore', name: 'Kore (Gentle & Smooth)', gender: 'Female' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-950/90 backdrop-blur-2xl animate-fade-in">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative flex flex-col items-center justify-between w-full h-full max-w-4xl p-6 md:p-10 z-10">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between w-full">
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

        {/* Live Mic Activity VU Meter Header */}
        <div className="flex items-center gap-6 mt-3 px-5 py-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
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

          <span className="text-gray-600">|</span>

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

        {/* Center: 3D Organic AI Visualizer */}
        <div className="flex flex-col items-center justify-center flex-1 w-full my-3">
          <div className="relative w-80 h-80 md:w-[400px] md:h-[400px] flex items-center justify-center animate-subtle-float">
            <VoiceVisualizer
              analyser={analyser}
              outputAnalyser={outputAnalyser}
              isActive={status !== 'idle' && status !== 'error'}
              status={status}
              mode={visualMode}
            />
          </div>

          {/* Subtitles / Live Transcript Box */}
          <div className="w-full max-w-2xl min-h-[96px] px-7 py-4 rounded-3xl glass-panel-glow flex flex-col items-center justify-center text-center shadow-2xl transition-all">
            {errorMessage ? (
              <div className="text-red-400 text-sm font-medium flex items-center gap-2">
                <span>⚠️ {errorMessage}</span>
              </div>
            ) : liveAiText ? (
              <p className="text-base md:text-lg text-purple-100 font-medium leading-relaxed animate-fade-in selection:bg-purple-500/30">
                "{liveAiText}"
              </p>
            ) : transcriptHistory.length > 0 ? (
              <p className="text-sm md:text-base text-gray-300 italic">
                "{transcriptHistory[transcriptHistory.length - 1].text}"
              </p>
            ) : micVolume > 5 ? (
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold animate-pulse">
                <Mic className="w-4 h-4" />
                <span>Hearing your voice loud & clear... keep speaking!</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                <span>Speak into your microphone to talk to Gemini Live...</span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Call Controls */}
        <div className="flex items-center justify-center gap-6 w-full pb-2">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl transition-all duration-200 shadow-xl ${
              isMuted
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-dark-800 hover:bg-dark-750 text-gray-200 border border-white/10 hover:border-white/20'
            }`}
            title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* End Call / Leave Button */}
          <button
            onClick={onClose}
            className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-2xl shadow-rose-600/40 transition-all hover:scale-105 active:scale-95 border border-rose-400/30"
            title="End Voice Session"
          >
            <PhoneOff className="w-7 h-7" />
          </button>

          {/* Speaker Mute Button */}
          <button
            onClick={toggleSpeaker}
            className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl transition-all duration-200 shadow-xl ${
              isSpeakerMuted
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-dark-800 hover:bg-dark-750 text-gray-200 border border-white/10 hover:border-white/20'
            }`}
            title={isSpeakerMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isSpeakerMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </button>
        </div>

      </div>
    </div>
  );
};
