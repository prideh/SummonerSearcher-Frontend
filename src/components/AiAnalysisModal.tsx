import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { chatWithAi } from '../api/ai';

interface AiContextData {
  summonerName: string;
  primaryRole: string;
  totalGamesAnalyzed: number;
  [key: string]: string | number | unknown;
}

interface AiAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  summonerName: string;
  context: AiContextData;
}

interface Message {
  role: 'user' | 'model';
  content: string;
}

const AiAnalysisModal: React.FC<AiAnalysisModalProps> = ({ isOpen, onClose, summonerName, context }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const hasInitialized = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const currentMessages = messagesRef.current;
    setMessages(prev => [...prev, { role: 'user' as const, content: text }]);
    setInput('');
    setLoading(true);

    try {
      const response = await chatWithAi(context, currentMessages, text);
      
      setMessages(prev => [...prev, { role: 'model', content: response }]);
    } catch (error) {
      console.error('Failed to get AI response:', error);
      setMessages(prev => [...prev, { role: 'model', content: 'Sorry, I encountered an error while analyzing the data.' }]);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    if (isOpen && !hasInitialized.current) {
      hasInitialized.current = true;
      handleSendMessage('Analyze this player based on the provided stats.');
    }
    if (!isOpen) {
        hasInitialized.current = false;
        setMessages([]);
    }
  }, [isOpen, handleSendMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-2xl h-[80vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <span className="text-2xl">🤖</span> AI Coach: {summonerName}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[85%] rounded-lg p-3 ${
                  msg.role === 'user' 
                    ? 'bg-cyan-600 text-white rounded-br-none' 
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-bl-none shadow-sm'
                }`}
              >
                {msg.role === 'model' ? (
                  <div className="prose dark:prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg rounded-bl-none border border-gray-200 dark:border-gray-700 shadow-sm flex items-center space-x-2">
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage(input)}
              placeholder="Ask a question about this player..."
              className="flex-1 bg-gray-100 dark:bg-gray-800 border-none rounded-lg px-4 py-2 focus:ring-2 focus:ring-cyan-500 dark:text-white"
              disabled={loading}
            />
            <button
              onClick={() => handleSendMessage(input)}
              disabled={loading || !input.trim()}
              className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiAnalysisModal;
