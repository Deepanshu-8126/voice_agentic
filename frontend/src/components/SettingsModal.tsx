import React, { useState } from 'react';
import {
  X,
  Key,
  Sparkles,
  Volume2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  SlidersHorizontal
} from 'lucide-react';
import type { AppSettings, ModelOption } from '../types';
import { verifyApiKey } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  models: ModelOption[];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  models
}) => {
  const [apiKey, setApiKey] = useState(settings.apiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState(settings.selectedModel || 'gemini-3.7-flash');
  const [selectedVoice, setSelectedVoice] = useState(settings.selectedVoice || 'Aoede');
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt || '');
  const [temperature, setTemperature] = useState(settings.temperature ?? 0.7);

  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; message?: string } | null>(null);

  if (!isOpen) return null;

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await verifyApiKey(apiKey);
      if (res.valid) {
        setVerifyResult({ valid: true, message: 'Google Gemini API Key is valid & connected!' });
      } else {
        setVerifyResult({ valid: false, message: res.error || 'Invalid API Key' });
      }
    } catch (e: any) {
      setVerifyResult({ valid: false, message: e.message || 'Verification failed' });
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = () => {
    onSaveSettings({
      apiKey: apiKey.trim(),
      selectedModel,
      selectedVoice,
      systemPrompt,
      temperature,
      voiceMode: 'live_ws',
      autoSpeak: false
    });
    onClose();
  };

  const voices = [
    { id: 'Aoede', name: 'Aoede (Warm & Natural)', gender: 'Female' },
    { id: 'Puck', name: 'Puck (Playful & Clear)', gender: 'Male' },
    { id: 'Charon', name: 'Charon (Deep & Calm)', gender: 'Male' },
    { id: 'Fenrir', name: 'Fenrir (Energetic)', gender: 'Male' },
    { id: 'Kore', name: 'Kore (Gentle & Smooth)', gender: 'Female' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-950/80 backdrop-blur-xl p-4 animate-fade-in">
      <div className="relative w-full max-w-xl glass-panel border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-bold text-white tracking-tight">AI Studio Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Gemini API Key */}
          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs font-bold text-gray-300">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-purple-400" />
                Google Gemini API Key
              </span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-purple-400 hover:underline"
              >
                Get free key from Google AI Studio &rarr;
              </a>
            </label>
            <div className="relative flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy... or loaded from .env"
                className="w-full pl-3.5 pr-24 py-2.5 rounded-2xl bg-dark-950 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 font-mono"
              />
              <div className="absolute right-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg"
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={verifying}
                  className="px-2.5 py-1 text-xs font-semibold bg-white/10 hover:bg-white/20 disabled:opacity-50 text-gray-200 rounded-xl border border-white/10 transition-colors flex items-center gap-1"
                >
                  {verifying ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Test'}
                </button>
              </div>
            </div>

            {verifyResult && (
              <div className={`flex items-center gap-2 text-xs p-3 rounded-2xl ${
                verifyResult.valid
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
              }`}>
                {verifyResult.valid ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{verifyResult.message}</span>
              </div>
            )}
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-300">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Primary AI Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-dark-950 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer"
            >
              {models.length > 0 ? (
                models.map(m => (
                  <option key={m.id} value={m.id} className="bg-dark-900 text-gray-200">
                    {m.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="gemini-3.8-flash">Gemini 3.8 Flash (Latest & Best Live Voice)</option>
                  <option value="gemini-3.7-flash">Gemini 3.7 Flash</option>
                  <option value="gemini-flash-latest">Gemini Flash Latest</option>
                </>
              )}
            </select>
          </div>

          {/* Default Voice Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-300">
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              Live Voice Agent Tone
            </label>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-dark-950 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer"
            >
              {voices.map(v => (
                <option key={v.id} value={v.id} className="bg-dark-900 text-gray-200">
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {/* Temperature Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-300">
              <span>Creativity / Temperature</span>
              <span className="font-mono text-purple-400">{temperature}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-400 font-mono">
              <span>Precise (0.0)</span>
              <span>Balanced (0.7)</span>
              <span>Creative (1.5)</span>
            </div>
          </div>

          {/* System Prompt */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-300">
              System Instruction / Persona
            </label>
            <textarea
              rows={3}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="e.g. You are an expert AI software engineer and friendly real-time voice conversationalist."
              className="w-full p-3.5 rounded-2xl bg-dark-950 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 resize-none font-mono"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.08] bg-white/[0.02]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-tr from-indigo-500 to-purple-600 hover:opacity-90 rounded-2xl shadow-lg shadow-purple-500/25 transition-transform active:scale-95"
          >
            Save Settings
          </button>
        </div>

      </div>
    </div>
  );
};
