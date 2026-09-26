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
  Edit2
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
      <div className="flex flex-col items-center justify-between w-16 h-full py-4 bg-chatBg-sidebar border-r border-gray-800/80 transition-all duration-300">
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onToggleCollapse}
            className="p-2.5 rounded-xl hover:bg-chatBg-700 text-gray-400 hover:text-white transition-colors"
            title="Expand Sidebar"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            onClick={onNewChat}
            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-transform active:scale-95"
            title="New Chat"
          >
            <Plus className="w-5 h-5" />
          </button>

          <button
            onClick={onOpenVoiceModal}
            className="p-2.5 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md hover:opacity-90 transition-all"
            title="Live Voice Call"
          >
            <Mic className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onOpenSettings}
            className="p-2.5 rounded-xl hover:bg-chatBg-700 text-gray-400 hover:text-white transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-between w-72 h-full bg-chatBg-sidebar border-r border-gray-800/80 transition-all duration-300">
      
      {/* Top Section */}
      <div className="flex flex-col p-3 space-y-3">
        {/* Header & Collapse */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm tracking-wide text-gray-100">Kilo AI Studio</span>
          </div>

          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg hover:bg-chatBg-700 text-gray-400 hover:text-white transition-colors"
            title="Collapse Sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl bg-chatBg-700 hover:bg-chatBg-600 border border-gray-700/60 text-gray-200 text-sm font-medium transition-all shadow-sm group active:scale-[0.98]"
        >
          <div className="flex items-center gap-2.5">
            <Plus className="w-4 h-4 text-blue-400 group-hover:rotate-90 transition-transform duration-200" />
            <span>New Chat</span>
          </div>
          <span className="text-[10px] text-gray-400 bg-chatBg-800 px-1.5 py-0.5 rounded border border-gray-700">Ctrl+K</span>
        </button>

        {/* Live Voice Call Button Shortcut */}
        <button
          onClick={onOpenVoiceModal}
          className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600/30 via-indigo-600/20 to-blue-600/30 border border-purple-500/30 hover:border-purple-500/60 text-purple-200 text-sm font-medium transition-all shadow-md group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white shadow-sm">
              <Mic className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <span>Live Voice Mode</span>
          </div>
          <span className="text-[10px] text-purple-300 font-semibold px-2 py-0.5 rounded-full bg-purple-500/20">LIVE</span>
        </button>

        {/* Search Chats */}
        {conversations.length > 4 && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-chatBg-800 text-xs text-gray-200 placeholder-gray-500 border border-gray-700/60 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* Middle: Chat History List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        <div className="px-2 pt-2 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          Recent Conversations
        </div>

        {filteredConversations.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-gray-500">
            No chats yet. Start a conversation!
          </div>
        ) : (
          filteredConversations.map((c) => {
            const isActive = c.id === activeId;
            const isEditing = editingId === c.id;

            return (
              <div
                key={c.id}
                onClick={() => onSelectConversation(c.id)}
                className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-chatBg-700 text-white font-medium border border-gray-700/80 shadow-sm'
                    : 'text-gray-300 hover:bg-chatBg-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                  <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-400'}`} />
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
                      className="w-full bg-chatBg-900 px-1.5 py-0.5 rounded text-xs text-white border border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <span className="truncate">{c.title || 'Untitled Chat'}</span>
                  )}
                </div>

                {/* Quick actions on hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pl-2">
                  {isEditing ? (
                    <button
                      onClick={(e) => saveRename(c.id, e)}
                      className="p-1 text-green-400 hover:text-green-300 rounded hover:bg-chatBg-600"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={(e) => startRename(c, e)}
                        className="p-1 text-gray-400 hover:text-gray-200 rounded hover:bg-chatBg-600"
                        title="Rename"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(c.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-400 rounded hover:bg-chatBg-600"
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
      <div className="p-3 border-t border-gray-800/80 bg-chatBg-sidebar space-y-1">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-xs font-medium text-gray-300 hover:text-white hover:bg-chatBg-800 transition-colors"
        >
          <Settings className="w-4 h-4 text-gray-400" />
          <span>Settings & API Key</span>
        </button>
      </div>

    </div>
  );
};
