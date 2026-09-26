import React, { useState, useRef, useEffect } from 'react';
import {
  Square,
  Mic,
  MicOff,
  Radio,
  Sparkles,
  Sliders,
  Trash2,
  Menu,
  Cpu,
  Compass,
  FileCode,
  ArrowUp
} from 'lucide-react';
import type { Conversation, AppSettings, ModelOption } from '../types';
import { MessageItem } from './MessageItem';

interface ChatAreaProps {
  conversation: Conversation | null;
  onSendMessage: (text: string) => void;
  onStopStreaming: () => void;
  isStreaming: boolean;
  onOpenVoiceModal: () => void;
  onOpenSettings: () => void;
  onClearCurrentChat: () => void;
  onToggleSidebar: () => void;
  isSidebarCollapsed: boolean;
  settings: AppSettings;
  onModelChange: (model: string) => void;
  models: ModelOption[];
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  conversation,
  onSendMessage,
  onStopStreaming,
  isStreaming,
  onOpenVoiceModal,
  onOpenSettings,
  onClearCurrentChat,
  onToggleSidebar,
  isSidebarCollapsed,
  settings,
  onModelChange,
  models
}) => {
  const [inputText, setInputText] = useState('');
  const [isDictating, setIsDictating] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const messages = conversation ? conversation.messages : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
    }
  }, [inputText]);

  const handleSend = () => {
    if (!inputText.trim() || isStreaming) return;
    onSendMessage(inputText.trim());
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. You can use the Live Voice Mode button instead!');
      return;
    }

    if (isDictating) {
      recognitionRef.current?.stop();
      setIsDictating(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsDictating(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInputText(prev => prev ? `${prev} ${transcript}` : transcript);
        }
      };

      recognition.onerror = () => {
        setIsDictating(false);
      };

      recognition.onend = () => {
        setIsDictating(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsDictating(false);
    }
  };

  const starterCards = [
    {
      icon: <Radio className="w-5 h-5 text-purple-400" />,
      tag: 'Realtime Voice',
      title: 'Gemini Live Voice Studio',
      desc: 'Bidirectional low-latency audio stream with reactive 3D glowing voice orb.',
      action: () => onOpenVoiceModal()
    },
    {
      icon: <FileCode className="w-5 h-5 text-cyan-400" />,
      tag: 'Development',
      title: 'Full-Stack & Systems Coding',
      desc: 'Build scalable Python FastAPI, WebSockets, or high-performance React code.',
      prompt: 'Write a high-performance Python FastAPI service with WebSockets and error handling.'
    },
    {
      icon: <Cpu className="w-5 h-5 text-indigo-400" />,
      tag: 'Architecture',
      title: 'Deep System Design',
      desc: 'Analyze multi-modal streaming architectures, PCM audio pipelines & WebRTC.',
      prompt: 'Explain the internal architecture of Gemini 2.0/3.8 Multimodal Live WebSocket protocol.'
    },
    {
      icon: <Compass className="w-5 h-5 text-emerald-400" />,
      tag: 'Assistant',
      title: 'Conversational Brainstorming',
      desc: 'Explore creative ideas, optimize workflows, and generate technical solutions.',
      prompt: 'Help me plan the architecture for an autonomous AI developer agent with streaming audio.'
    }
  ];

  return (
    <div className="flex flex-col flex-1 h-full bg-dark-950 overflow-hidden relative">
      
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.07] bg-dark-950/80 backdrop-blur-xl z-20">
        <div className="flex items-center gap-3">
          {isSidebarCollapsed && (
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Expand Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Model Selector Pill */}
          <div className="flex items-center gap-2">
            <select
              value={settings.selectedModel}
              onChange={(e) => onModelChange(e.target.value)}
              className="bg-dark-900 hover:bg-dark-850 text-gray-200 font-semibold text-xs px-3.5 py-1.5 rounded-xl border border-white/10 hover:border-purple-500/40 focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer shadow-sm transition-all"
            >
              {models.length > 0 ? (
                models.map(m => (
                  <option key={m.id} value={m.id} className="bg-dark-900 text-gray-200">
                    {m.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="gemini-3.7-flash">Gemini 3.7 Flash (Stable)</option>
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                  <option value="gemini-3.8-flash">Gemini 3.8 Flash</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-2.5">
          {/* Live Voice Mode Launch Button */}
          <button
            onClick={onOpenVoiceModal}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:opacity-95 text-white text-xs font-semibold shadow-lg shadow-purple-500/25 transition-all active:scale-95 border border-purple-400/30"
            title="Start Live Voice Call"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span className="hidden sm:inline">Voice Agent</span>
          </button>

          {/* Clear Current Chat */}
          {messages.length > 0 && (
            <button
              onClick={onClearCurrentChat}
              className="p-2 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-white/10 transition-colors"
              title="Clear messages"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[72vh] max-w-3xl mx-auto text-center px-4 animate-fade-in">
            
            {/* Hero Glowing AI Icon */}
            <div className="relative mb-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 flex items-center justify-center text-white shadow-2xl shadow-purple-500/40 animate-glow-pulse">
                <Sparkles className="w-8 h-8" />
              </div>
            </div>

            <h1 className="text-2xl md:text-4xl font-extrabold text-white mb-2.5 tracking-tight">
              What can I help you build today?
            </h1>
            <p className="text-sm text-gray-400 max-w-lg mb-8 leading-relaxed">
              Supercharged with Google Gemini 3.8 Flash, real-time bidirectional audio streaming & low-latency voice intelligence.
            </p>

            {/* Quick Starter Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full text-left">
              {starterCards.map((card, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (card.action) card.action();
                    else if (card.prompt) onSendMessage(card.prompt);
                  }}
                  className="group relative flex flex-col p-4 rounded-2xl bg-dark-900/90 hover:bg-dark-850 border border-white/[0.08] hover:border-purple-500/40 transition-all text-left shadow-lg hover:shadow-purple-500/10 active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-xl bg-white/[0.05] border border-white/10 group-hover:border-purple-500/30 transition-colors">
                      {card.icon}
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 group-hover:text-purple-300 font-mono tracking-wider uppercase">
                      {card.tag}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors mb-1">
                    {card.title}
                  </h3>
                  <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                    {card.desc}
                  </p>
                </button>
              ))}
            </div>

          </div>
        ) : (
          messages.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              selectedVoice={settings.selectedVoice}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Modern Floating Input Bar Section */}
      <div className="p-4 md:p-6 bg-gradient-to-t from-dark-950 via-dark-950 to-transparent z-20">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex flex-col glass-panel rounded-3xl shadow-2xl focus-within:border-purple-500/50 transition-all">
            
            {/* Autosizing Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Gemini or click Voice Mode..."
              className="w-full pl-5 pr-28 py-4 bg-transparent text-sm text-gray-100 placeholder-gray-500 focus:outline-none resize-none max-h-52 overflow-y-auto"
            />

            {/* Bottom Actions inside input card */}
            <div className="flex items-center justify-between px-4 pb-3 pt-1 border-t border-white/[0.04]">
              <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.05] text-[10px] font-semibold text-purple-300 border border-white/10">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  {settings.selectedModel}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Voice Dictation (Speech to text) */}
                <button
                  onClick={toggleDictation}
                  type="button"
                  title={isDictating ? 'Stop microphone dictation' : 'Speech-to-text dictation'}
                  className={`p-2 rounded-xl transition-all ${
                    isDictating
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/10'
                  }`}
                >
                  {isDictating ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {/* Live Voice Studio Button */}
                <button
                  onClick={onOpenVoiceModal}
                  type="button"
                  title="Launch Real-time Voice Mode"
                  className="p-2 rounded-xl text-purple-400 hover:text-purple-300 hover:bg-purple-500/15 transition-all"
                >
                  <Radio className="w-4 h-4" />
                </button>

                {/* Send / Stop Streaming Button */}
                {isStreaming ? (
                  <button
                    onClick={onStopStreaming}
                    className="p-2 rounded-xl bg-white text-dark-950 hover:bg-gray-200 transition-all shadow-md active:scale-95"
                    title="Stop Generating"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim()}
                    className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 hover:opacity-90 disabled:opacity-25 text-white transition-all shadow-md shadow-indigo-500/20 active:scale-95"
                    title="Send message"
                  >
                    <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                  </button>
                )}
              </div>
            </div>

          </div>

          <div className="text-center mt-2.5 text-[10px] text-gray-500 font-mono">
            Powered by Google Gemini 3.8 Flash • Real-time Multimodal Live Audio Stream
          </div>
        </div>
      </div>

    </div>
  );
};
