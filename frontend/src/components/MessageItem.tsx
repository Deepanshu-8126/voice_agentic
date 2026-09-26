import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Copy,
  Check,
  Volume2,
  VolumeX,
  Sparkles,
  User,
  Terminal
} from 'lucide-react';
import type { Message } from '../types';
import { speakTextBrowser } from '../services/api';

interface MessageItemProps {
  message: Message;
  selectedVoice?: string;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, selectedVoice }) => {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = async () => {
    if (isSpeaking) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    await speakTextBrowser(message.content, selectedVoice);
    setIsSpeaking(false);
  };

  return (
    <div className={`group flex gap-4 py-5 px-4 md:px-6 w-full max-w-4xl mx-auto rounded-2xl transition-colors ${
      isUser ? 'bg-transparent' : 'bg-chatBg-800/40 border border-gray-800/40'
    }`}>
      {/* Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <User className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-400">
            {isUser ? 'You' : 'Gemini AI'}
          </span>
          <span className="text-[10px] text-gray-500">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Markdown message body */}
        <div className="markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                const codeString = String(children).replace(/\n$/, '');

                if (!inline && match) {
                  return (
                    <CodeBlock
                      language={match[1]}
                      code={codeString}
                    />
                  );
                }

                if (!inline) {
                  return (
                    <CodeBlock
                      language="text"
                      code={codeString}
                    />
                  );
                }

                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }
            }}
          >
            {message.content}
          </ReactMarkdown>

          {message.isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-blue-400 animate-pulse align-middle" />
          )}
        </div>

        {/* Action Buttons for AI responses */}
        {!isUser && !message.isStreaming && (
          <div className="flex items-center gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              title="Copy message"
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded-md hover:bg-chatBg-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handleSpeak}
              title={isSpeaking ? 'Stop speech' : 'Read aloud'}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${
                isSpeaking
                  ? 'text-purple-400 bg-purple-500/10'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-chatBg-700'
              }`}
            >
              {isSpeaking ? <VolumeX className="w-3.5 h-3.5 animate-pulse" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Sub-component for syntax highlighted code block
interface CodeBlockProps {
  language: string;
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 rounded-xl overflow-hidden bg-[#121212] border border-gray-800 shadow-lg">
      {/* Code Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1b1b1b] border-b border-gray-800 text-xs text-gray-400 font-mono">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-blue-400" />
          <span className="uppercase font-semibold tracking-wider text-gray-300">{language}</span>
        </div>
        <button
          onClick={handleCopyCode}
          className="flex items-center gap-1 text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-[#2c2c2c] transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy code'}</span>
        </button>
      </div>

      {/* Code Body */}
      <pre className="p-4 overflow-x-auto text-sm font-mono text-gray-200 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};
