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
  X
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
  
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [outputAnalyser, setOutputAnalyser] = useState<AnalyserNode | null>(null);

  const [liveUserText] = useState('');
  const [liveAiText, setLiveAiText] = useState('');
  const [transcriptHistory, setTranscriptHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const currentAiTextRef = useRef('');

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
      // 1. Initialize Audio Context & Mic
      const micAnalyser = await audioProcessor.startMicCapture((base64Pcm) => {
        if (!isMutedRef.current && liveClient.active()) {
          liveClient.sendAudioChunk(base64Pcm);
        }
      });
      setAnalyser(micAnalyser);
      setOutputAnalyser(audioProcessor.getOutputAnalyser());

      // 2. Connect to Live WebSocket Bridge
      liveClient.connect(
        {
          apiKey: settings.apiKey,
          voice: selectedVoice,
          model: 'models/gemini-2.0-flash-exp',
          systemPrompt: settings.systemPrompt || 'You are an intelligent, low-latency, warm conversational voice assistant.'
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

  const voices = [
    { id: 'Aoede', name: 'Aoede (Warm & Natural)', gender: 'Female' },
    { id: 'Puck', name: 'Puck (Playful & Clear)', gender: 'Male' },
    { id: 'Charon', name: 'Charon (Deep & Calm)', gender: 'Male' },
    { id: 'Fenrir', name: 'Fenrir (Energetic)', gender: 'Male' },
    { id: 'Kore', name: 'Kore (Gentle & Smooth)', gender: 'Female' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl animate-fade-in">
      <div className="relative flex flex-col items-center justify-between w-full h-full max-w-4xl p-6 md:p-8">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 text-white shadow-lg shadow-purple-500/20">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                Gemini Live Voice Agent
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Ultra Low Latency
                </span>
              </h2>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className={`w-2 h-2 rounded-full ${
                  status === 'speaking' ? 'bg-purple-500 animate-ping' :
                  status === 'listening' ? 'bg-emerald-500 animate-pulse' :
                  status === 'processing' ? 'bg-amber-500 animate-spin' :
                  status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                }`} />
                <span className="capitalize">
                  {status === 'speaking' ? 'AI is speaking...' :
                   status === 'listening' ? (isMuted ? 'Microphone Muted' : 'Listening to your voice...') :
                   status === 'processing' ? 'Connecting to Gemini...' :
                   status === 'error' ? 'Connection Error' : 'Ready'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Voice Selector */}
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="bg-chatBg-800 text-gray-200 text-xs px-3 py-2 rounded-xl border border-gray-700 hover:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {voices.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>

            {/* Visualizer Mode switch */}
            <button
              onClick={() => setVisualMode(visualMode === 'orb' ? 'wave' : 'orb')}
              title={`Switch to ${visualMode === 'orb' ? 'Waveform' : 'Orb'} visualizer`}
              className="p-2.5 rounded-xl bg-chatBg-800 hover:bg-chatBg-700 text-gray-300 transition-colors border border-gray-700"
            >
              {visualMode === 'orb' ? <Activity className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-chatBg-800 hover:bg-chatBg-700 text-gray-300 hover:text-white transition-colors border border-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: Glowing Visualizer & Live Transcripts */}
        <div className="flex flex-col items-center justify-center flex-1 w-full my-4">
          <div className="relative w-72 h-72 md:w-96 md:h-96 flex items-center justify-center">
            <VoiceVisualizer
              analyser={analyser}
              outputAnalyser={outputAnalyser}
              isActive={status !== 'idle' && status !== 'error'}
              status={status}
              mode={visualMode}
            />
          </div>

          {/* Subtitles / Live Transcript Box */}
          <div className="w-full max-w-xl min-h-[90px] px-6 py-4 rounded-2xl bg-chatBg-800/80 border border-gray-800 backdrop-blur-md flex flex-col items-center justify-center text-center shadow-2xl transition-all">
            {errorMessage ? (
              <div className="text-red-400 text-sm font-medium flex items-center gap-2">
                <span>⚠️ {errorMessage}</span>
              </div>
            ) : liveAiText ? (
              <p className="text-base md:text-lg text-purple-200 font-medium leading-relaxed animate-fade-in">
                "{liveAiText}"
              </p>
            ) : transcriptHistory.length > 0 ? (
              <p className="text-sm md:text-base text-gray-300 italic">
                "{transcriptHistory[transcriptHistory.length - 1].text}"
              </p>
            ) : (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                <span>Start speaking into your mic to chat in real-time...</span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Call Controls */}
        <div className="flex items-center justify-center gap-6 w-full pb-4">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className={`flex flex-col items-center gap-1.5 p-4 rounded-full transition-all duration-200 shadow-lg ${
              isMuted
                ? 'bg-amber-600/30 text-amber-400 border border-amber-500/50 hover:bg-amber-600/40'
                : 'bg-chatBg-700 hover:bg-chatBg-600 text-gray-200 border border-gray-600'
            }`}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* End Call / Leave Button */}
          <button
            onClick={onClose}
            className="flex items-center justify-center w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-600/30 transition-all hover:scale-105 active:scale-95"
            title="End Voice Call"
          >
            <PhoneOff className="w-7 h-7" />
          </button>

          {/* Speaker Mute Button */}
          <button
            onClick={toggleSpeaker}
            className={`flex flex-col items-center gap-1.5 p-4 rounded-full transition-all duration-200 shadow-lg ${
              isSpeakerMuted
                ? 'bg-amber-600/30 text-amber-400 border border-amber-500/50 hover:bg-amber-600/40'
                : 'bg-chatBg-700 hover:bg-chatBg-600 text-gray-200 border border-gray-600'
            }`}
          >
            {isSpeakerMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </button>
        </div>

      </div>
    </div>
  );
};
