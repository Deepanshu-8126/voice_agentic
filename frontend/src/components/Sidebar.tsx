import React, { useState } from 'react';
import {
  Plus,
  MessageSquare,
  Trash2,
  Settings,
  Mic,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Search,
  Check,
  Edit2,
  SlidersHorizontal
} from 'lucide-react';
import type { Conversation } from '../types';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onOpenSettings: () => void;
  onOpenVoiceModal: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onOpenSettings,
  onOpenVoiceModal,
  isCollapsed,
  onToggleCollapse
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startRename = (c: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(c.id);
    setEditTitle(c.title);
  };

  const saveRename = (id: string, e: React.FormEvent | React.MouseEvent) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center justify-between w-16 h-full py-4 bg-dark-900 border-r border-white/[0.07] transition-all duration-300">
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onToggleCollapse}
            className="p-2.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="Expand Sidebar"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            onClick={onNewChat}
            className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 hover:opacity-90 text-white shadow-lg shadow-indigo-500/20 transition-transform active:scale-95"
            title="New Chat"
          >
            <Plus className="w-5 h-5" />
          </button>

          <button
            onClick={onOpenVoiceModal}
            className="p-2.5 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 text-white shadow-lg shadow-purple-500/25 hover:opacity-90 transition-all"
            title="Live Voice Studio"
          >
            <Mic className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onOpenSettings}
            className="p-2.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-between w-72 h-full bg-dark-900 border-r border-white/[0.07] transition-all duration-300">
      
      {/* Top Section */}
      <div className="flex flex-col p-3.5 space-y-3">
        {/* Header & Logo */}
        <div className="flex items-center justify-between px-2 pt-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                Kilo AI Studio
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">PRO</span>
              </span>
              <span className="text-[10px] text-gray-400 font-mono">Gemini 3.8 Flash</span>
            </div>
          </div>

          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="Collapse Sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 text-gray-200 text-xs font-semibold transition-all shadow-sm group active:scale-[0.98]"
        >
          <div className="flex items-center gap-2.5">
            <Plus className="w-4 h-4 text-indigo-400 group-hover:rotate-90 transition-transform duration-200" />
            <span>New Chat</span>
          </div>
          <span className="text-[10px] text-gray-400 font-mono bg-dark-950 px-2 py-0.5 rounded-md border border-white/10">Ctrl+K</span>
        </button>

        {/* Live Voice Studio Quick Launch Banner */}
        <button
          onClick={onOpenVoiceModal}
          className="relative overflow-hidden flex items-center justify-between w-full px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600/25 via-indigo-600/20 to-cyan-500/25 border border-purple-500/30 hover:border-purple-400/60 text-purple-200 text-xs font-semibold transition-all shadow-md group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Mic className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <span>Live Voice Studio</span>
          </div>
          <span className="text-[9px] font-bold tracking-wider text-cyan-300 px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/30">
            REALTIME
          </span>
        </button>

        {/* Search Chats Filter */}
        {conversations.length > 3 && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search chat history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-dark-950 text-xs text-gray-200 placeholder-gray-500 border border-white/10 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        )}
      </div>

      {/* Middle: Chat History List */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        <div className="px-2 pt-2 pb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
          Conversations
        </div>

        {filteredConversations.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-gray-500 flex flex-col items-center gap-2">
            <MessageSquare className="w-6 h-6 text-gray-600 stroke-[1.5]" />
            <span>No conversation yet.<br/>Start a fresh prompt!</span>
          </div>
        ) : (
          filteredConversations.map((c) => {
            const isActive = c.id === activeId;
            const isEditing = editingId === c.id;

            return (
              <div
                key={c.id}
                onClick={() => onSelectConversation(c.id)}
                className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-500/20 to-indigo-500/10 text-white font-semibold border border-purple-500/30 shadow-sm'
                    : 'text-gray-300 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                  <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-purple-400' : 'text-gray-500'}`} />
                  {isEditing ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename(c.id, e);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      className="w-full bg-dark-950 px-2 py-0.5 rounded text-xs text-white border border-purple-500 focus:outline-none"
                    />
                  ) : (
                    <span className="truncate">{c.title || 'Untitled Chat'}</span>
                  )}
                </div>

                {/* Hover Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pl-2">
                  {isEditing ? (
                    <button
                      onClick={(e) => saveRename(c.id, e)}
                      className="p-1 text-emerald-400 hover:text-emerald-300 rounded hover:bg-white/10"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={(e) => startRename(c, e)}
                        className="p-1 text-gray-400 hover:text-gray-200 rounded hover:bg-white/10"
                        title="Rename"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(c.id);
                        }}
                        className="p-1 text-gray-400 hover:text-rose-400 rounded hover:bg-white/10"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom: Settings Bar */}
      <div className="p-3 border-t border-white/[0.07] bg-dark-900 space-y-1">
        <button
          onClick={onOpenSettings}
          className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-xs font-medium text-gray-300 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="w-4 h-4 text-purple-400" />
            <span>Settings & API Key</span>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500" title="Connected" />
        </button>
      </div>

    </div>
  );
};
