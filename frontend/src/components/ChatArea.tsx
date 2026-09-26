import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Square,
  Mic,
  MicOff,
  Radio,
  Sparkles,
  Sliders,
  Trash2,
  Menu,
  Code,
  Zap
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

  // Auto-scroll to bottom on message update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Adjust textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
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

  // Browser Speech-to-Text for typing
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
      title: 'Real-time Voice Agent',
      desc: 'Start low-latency bidirectional voice call with Gemini Live audio.',
      action: () => onOpenVoiceModal()
    },
    {
      icon: <Zap className="w-5 h-5 text-amber-400" />,
      title: 'Python / JavaScript Coding',
      desc: 'Write high-performance backend, async tasks, or modern UI code.',
      prompt: 'Write a modern Python FastAPI WebSocket service with error handling and logging.'
    },
    {
      icon: <Code className="w-5 h-5 text-blue-400" />,
      title: 'Explain Complex Tech',
      desc: 'Deep dive into architecture, AI models, and system design.',
      prompt: 'Explain how Gemini 2.0 Multimodal Live WebSocket protocol works with PCM audio.'
    },
    {
      icon: <Sparkles className="w-5 h-5 text-emerald-400" />,
      title: 'Voice Conversational Practice',
      desc: 'Practice speaking English or technical interview questions.',
      prompt: 'Let us practice technical interview questions. Ask me one question at a time.'
    }
  ];

  return (
    <div className="flex flex-col flex-1 h-full bg-chatBg-main overflow-hidden">
      
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/80 bg-chatBg-main z-10">
        <div className="flex items-center gap-3">
          {isSidebarCollapsed && (
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-chatBg-700 transition-colors"
              title="Expand Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Model Selector */}
          <div className="flex items-center gap-2">
            <select
              value={settings.selectedModel}
              onChange={(e) => onModelChange(e.target.value)}
              className="bg-chatBg-800 hover:bg-chatBg-700 text-gray-200 font-medium text-xs px-3 py-1.5 rounded-xl border border-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition-colors"
            >
              {models.length > 0 ? (
                models.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* Right header controls */}
        <div className="flex items-center gap-2">
          {/* Live Voice Call Button */}
          <button
            onClick={onOpenVoiceModal}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:opacity-90 text-white text-xs font-semibold shadow-md transition-all active:scale-95"
            title="Start Live Voice Call"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span className="hidden sm:inline">Voice Agent</span>
          </button>

          {/* Clear Current Chat */}
          {messages.length > 0 && (
            <button
              onClick={onClearCurrentChat}
              className="p-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-chatBg-700 transition-colors"
              title="Clear messages"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-chatBg-700 transition-colors"
            title="Dashboard Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-2xl mx-auto text-center px-4">
            
            {/* Hero Logo */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-purple-500/20 mb-4 animate-orb-glow">
              <Sparkles className="w-8 h-8" />
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">
              Kilo AI Voice & Chat Studio
            </h1>
            <p className="text-sm text-gray-400 max-w-md mb-8">
              Experience ultra low-latency Voice conversation with Gemini 2.0 Live and ChatGPT-level intelligent chat interface.
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
                  className="flex flex-col p-4 rounded-2xl bg-chatBg-800/80 hover:bg-chatBg-700/80 border border-gray-800/80 hover:border-gray-700 transition-all text-left group shadow-sm active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2.5 mb-1.5">
                    {card.icon}
                    <span className="text-xs font-semibold text-gray-200 group-hover:text-blue-400 transition-colors">
                      {card.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 line-clamp-2">
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

      {/* Input Bar Section */}
      <div className="p-4 bg-chatBg-main">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex flex-col bg-chatBg-input border border-gray-700/80 rounded-2xl shadow-xl focus-within:border-gray-500 transition-all">
            
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything or use Voice mode..."
              className="w-full pl-4 pr-28 py-3.5 bg-transparent text-sm text-gray-100 placeholder-gray-400 focus:outline-none resize-none max-h-48 overflow-y-auto"
            />

            {/* Bottom Actions inside input */}
            <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-chatBg-800 text-[11px] border border-gray-700/50">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  {settings.selectedModel}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Voice Dictation (Speech to text in input) */}
                <button
                  onClick={toggleDictation}
                  type="button"
                  title={isDictating ? 'Stop microphone dictation' : 'Speak to dictate text'}
                  className={`p-2 rounded-xl transition-colors ${
                    isDictating
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-chatBg-700'
                  }`}
                >
                  {isDictating ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {/* Live Voice Call Button */}
                <button
                  onClick={onOpenVoiceModal}
                  type="button"
                  title="Open Live Voice Call"
                  className="p-2 rounded-xl text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors"
                >
                  <Radio className="w-4 h-4" />
                </button>

                {/* Send / Stop Streaming Button */}
                {isStreaming ? (
                  <button
                    onClick={onStopStreaming}
                    className="p-2 rounded-xl bg-white text-black hover:bg-gray-200 transition-colors shadow-md"
                    title="Stop Generating"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim()}
                    className="p-2 rounded-xl bg-white text-black disabled:opacity-30 disabled:hover:bg-white hover:bg-gray-200 transition-all shadow-md active:scale-95"
                    title="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

          </div>

          <div className="text-center mt-2 text-[11px] text-gray-500">
            Powered by Google Gemini 2.0 Flash • Low-latency Speech & Live Audio WebSocket Ready
          </div>
        </div>
      </div>

    </div>
  );
};
