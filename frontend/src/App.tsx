import React, { useState, useEffect, useRef } from 'react';
import type { Conversation, Message, AppSettings, ModelOption } from './types';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { VoiceModal } from './components/VoiceModal';
import { SettingsModal } from './components/SettingsModal';
import { checkHealth, fetchModels, streamChatResponse } from './services/api';

const SETTINGS_KEY = 'kilo_ai_settings';
const CONVERSATIONS_KEY = 'kilo_ai_conversations';

export const App: React.FC = () => {
  // Settings State
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      apiKey: '',
      selectedModel: 'gemini-2.0-flash',
      selectedVoice: 'Aoede',
      systemPrompt: 'You are an intelligent, helpful, and concise AI assistant.',
      temperature: 0.7,
      voiceMode: 'live_ws',
      autoSpeak: false
    };
  });

  // Conversations State
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem(CONVERSATIONS_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  const [activeId, setActiveId] = useState<string | null>(() => {
    if (conversations.length > 0) return conversations[0].id;
    return null;
  });

  const [models, setModels] = useState<ModelOption[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const abortControllerRef = useRef<boolean>(false);

  // Sync settings to localStorage
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Sync conversations to localStorage
  useEffect(() => {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  }, [conversations]);

  // Health check and load models on startup
  useEffect(() => {
    const initApp = async () => {
      try {
        const health = await checkHealth();
        if (health.has_server_key && !settings.apiKey) {
          // Server has key configured in .env
        }
        const modelList = await fetchModels(settings.apiKey);
        setModels(modelList);
      } catch (e) {
        console.warn('Backend offline or initializing:', e);
      }
    };
    initApp();
  }, [settings.apiKey]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeConversation = conversations.find(c => c.id === activeId) || null;

  const handleNewChat = () => {
    const newConv: Conversation = {
      id: 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: settings.selectedModel
    };

    setConversations(prev => [newConv, ...prev]);
    setActiveId(newConv.id);
  };

  const handleSelectConversation = (id: string) => {
    setActiveId(id);
  };

  const handleDeleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) {
      const remaining = conversations.filter(c => c.id !== id);
      setActiveId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleRenameConversation = (id: string, newTitle: string) => {
    setConversations(prev =>
      prev.map(c => (c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c))
    );
  };

  const handleClearCurrentChat = () => {
    if (!activeId) return;
    setConversations(prev =>
      prev.map(c => (c.id === activeId ? { ...c, messages: [], updatedAt: Date.now() } : c))
    );
  };

  const handleModelChange = (model: string) => {
    setSettings(prev => ({ ...prev, selectedModel: model }));
    if (activeId) {
      setConversations(prev =>
        prev.map(c => (c.id === activeId ? { ...c, model } : c))
      );
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    let targetId = activeId;
    let currentConv = activeConversation;

    // If no active conversation, create one
    if (!targetId || !currentConv) {
      const newConv: Conversation = {
        id: 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        title: text.slice(0, 30),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: settings.selectedModel
      };
      setConversations(prev => [newConv, ...prev]);
      setActiveId(newConv.id);
      targetId = newConv.id;
      currentConv = newConv;
    }

    // Auto rename first message title
    if (currentConv.messages.length === 0) {
      const title = text.length > 28 ? text.slice(0, 28) + '...' : text;
      handleRenameConversation(targetId, title);
    }

    const userMessage: Message = {
      id: 'msg_' + Date.now() + '_u',
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    const assistantMsgId = 'msg_' + Date.now() + '_a';
    const assistantMessage: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true
    };

    // Update conversation with user and empty streaming assistant message
    const updatedMessages = [...currentConv.messages, userMessage, assistantMessage];
    setConversations(prev =>
      prev.map(c => (c.id === targetId ? { ...c, messages: updatedMessages, updatedAt: Date.now() } : c))
    );

    setIsStreaming(true);
    abortControllerRef.current = false;

    let streamedContent = '';

    await streamChatResponse(
      [...currentConv.messages, userMessage],
      {
        model: settings.selectedModel,
        systemPrompt: settings.systemPrompt,
        temperature: settings.temperature,
        apiKey: settings.apiKey || undefined
      },
      (chunk) => {
        if (abortControllerRef.current) return;
        streamedContent += chunk;
        setConversations(prev =>
          prev.map(c => {
            if (c.id !== targetId) return c;
            return {
              ...c,
              messages: c.messages.map(m =>
                m.id === assistantMsgId
                  ? { ...m, content: streamedContent, isStreaming: true }
                  : m
              )
            };
          })
        );
      },
      (error) => {
        setIsStreaming(false);
        setConversations(prev =>
          prev.map(c => {
            if (c.id !== targetId) return c;
            return {
              ...c,
              messages: c.messages.map(m =>
                m.id === assistantMsgId
                  ? { ...m, content: streamedContent ? `${streamedContent}\n\n⚠️ *Error: ${error}*` : `⚠️ *Error: ${error}*`, isStreaming: false }
                  : m
              )
            };
          })
        );
      },
      () => {
        setIsStreaming(false);
        setConversations(prev =>
          prev.map(c => {
            if (c.id !== targetId) return c;
            return {
              ...c,
              messages: c.messages.map(m =>
                m.id === assistantMsgId
                  ? { ...m, content: streamedContent || '(Empty response)', isStreaming: false }
                  : m
              )
            };
          })
        );
      }
    );
  };

  const handleStopStreaming = () => {
    abortControllerRef.current = true;
    setIsStreaming(false);
  };

  const handleVoiceTranscriptReceived = (userText: string, aiText: string) => {
    if (!aiText) return;

    let targetId = activeId;
    if (!targetId) {
      const newConv: Conversation = {
        id: 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        title: 'Voice Call',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: settings.selectedModel
      };
      setConversations(prev => [newConv, ...prev]);
      setActiveId(newConv.id);
      targetId = newConv.id;
    }

    const msgsToAdd: Message[] = [];
    if (userText) {
      msgsToAdd.push({
        id: 'msg_v_' + Date.now() + '_u',
        role: 'user',
        content: userText,
        timestamp: Date.now()
      });
    }
    msgsToAdd.push({
      id: 'msg_v_' + Date.now() + '_a',
      role: 'assistant',
      content: aiText,
      timestamp: Date.now()
    });

    setConversations(prev =>
      prev.map(c =>
        c.id === targetId
          ? { ...c, messages: [...c.messages, ...msgsToAdd], updatedAt: Date.now() }
          : c
      )
    );
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-chatBg-main text-gray-100">
      
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Chat Area */}
      <ChatArea
        conversation={activeConversation}
        onSendMessage={handleSendMessage}
        onStopStreaming={handleStopStreaming}
        isStreaming={isStreaming}
        onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onClearCurrentChat={handleClearCurrentChat}
        onToggleSidebar={() => setIsSidebarCollapsed(false)}
        isSidebarCollapsed={isSidebarCollapsed}
        settings={settings}
        onModelChange={handleModelChange}
        models={models}
      />

      {/* Voice Mode Live Overlay */}
      <VoiceModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        settings={settings}
        onTranscriptReceived={handleVoiceTranscriptReceived}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => setSettings(newSettings)}
        models={models}
      />

    </div>
  );
};
export default App;
