import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { chatWithAi, submitFeedback } from '../api/ai';

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
  interactionId?: string; // Track backend interaction ID
  feedback?: 'positive' | 'negative'; // User's feedback
  timestamp?: number; // When message was shown
}

const generatePersonalizedSuggestions = (context: AiContextData): string[] => {
  const suggestions = ["Analyze my profile"];
  
  if (context.primaryRole && context.primaryRole !== 'unknown' && typeof context.primaryRole === 'string') {
    let formattedRole = context.primaryRole.charAt(0).toUpperCase() + context.primaryRole.slice(1).toLowerCase();
    if (context.primaryRole === 'UTILITY') formattedRole = 'Support';
    if (context.primaryRole === 'BOTTOM') formattedRole = 'Bot Carry';
    suggestions.push(`Analyze my ${formattedRole} macro`);
  } else {
    suggestions.push("What are my biggest strengths?");
  }

  // Suggest an analysis on their most played champ instead of matchups
  const topChamps = context.topChampions as Array<{ name: string; games: number }> | undefined;
  if (topChamps && topChamps.length > 0) {
    suggestions.push(`How can I improve my ${topChamps[0].name}?`);
  } else {
    suggestions.push("How can I improve my CS?");
  }

  // Add role-specific learning questions
  if (context.primaryRole === 'JUNGLE') {
    suggestions.push("How is my jungle pathing?");
  } else if (context.primaryRole === 'SUPPORT' || context.primaryRole === 'UTILITY') {
    suggestions.push("How is my vision control?");
  } else {
    suggestions.push("How is my wave management?");
  }

  // Conditionally format the winrate prompt
  const winRate = parseFloat(context.winRate as string || '0');
  if (winRate > 55) {
    suggestions.push("How can I snowball my leads?");
  } else {
    suggestions.push("Why is my win rate low?");
  }
  
  // Return exactly 5 suggestions
  return suggestions.slice(0, 5);
};

const AiAnalysisModal: React.FC<AiAnalysisModalProps> = ({ isOpen, onClose, summonerName, context }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substring(7)}`);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  const STORAGE_KEY = `chat_history_${summonerName}`;
  const EXPIRATION_TIME = 30 * 60 * 1000; // 30 minutes
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
      const apiResponse = await chatWithAi(context, currentMessages, text, sessionId);
      
      // Parse suggestions from response
      let cleanResponse = apiResponse.response;
      const suggestionsMatch = apiResponse.response.match(/---SUGGESTIONS---\s*(\[[\s\S]*?\])/);
      
      if (suggestionsMatch) {
        try {
          let jsonStr = suggestionsMatch[1];
          jsonStr = jsonStr.replace(/,\s*\]/g, ']');
          
          const newSuggestions = JSON.parse(jsonStr);
          if (Array.isArray(newSuggestions)) {
            setSuggestions(newSuggestions);
          }
          cleanResponse = apiResponse.response.replace(suggestionsMatch[0], '').trim();
        } catch (e) {
          console.error('Failed to parse suggestions:', e);
          const manualMatches = suggestionsMatch[1].match(/"([^"]+)"/g);
          if (manualMatches) {
             const manualSuggestions = manualMatches.map(s => s.replace(/"/g, ''));
             setSuggestions(manualSuggestions);
             cleanResponse = apiResponse.response.replace(suggestionsMatch[0], '').trim();
          }
        }
      }

      setMessages(prev => [...prev, { 
        role: 'model', 
        content: cleanResponse,
        interactionId: apiResponse.interactionId,
        timestamp: Date.now()
      }]);
    } catch (error) {
      console.error('Failed to get AI response:', error);
      setMessages(prev => [...prev, { role: 'model', content: 'Sorry, I encountered an error while analyzing the data.' }]);
    } finally {
      setLoading(false);
    }
  }, [context]);

  const handleFeedback = async (interactionId: string | undefined, feedbackType: 'positive' | 'negative', messageTimestamp: number | undefined) => {
    if (!interactionId || !messageTimestamp) return;
    
    const engagementTime = Date.now() - messageTimestamp;
    
    try {
      await submitFeedback(interactionId, feedbackType, engagementTime, sessionId);
      
      // Update UI to show feedback was recorded
      setMessages(prev => prev.map(m => 
        m.interactionId === interactionId 
          ? { ...m, feedback: feedbackType } 
          : m
      ));
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  // Load history on mount
  useEffect(() => {
    if (isOpen && !hasInitialized.current) {
      hasInitialized.current = true;
      
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          const age = Date.now() - parsed.timestamp;
          
          if (age < EXPIRATION_TIME) {
            setMessages(parsed.messages);
            setSuggestions(parsed.suggestions);
            return;
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (e) {
        console.error('Failed to load chat history:', e);
      }

      // Default initialization if no valid history
      const personalizedSuggestions = generatePersonalizedSuggestions(context);
      setMessages([{ 
        role: 'model', 
        content: `Hi! I'm your AI Coach. I've analyzed ${context.totalGamesAnalyzed || 0} of your recent games. Ask me anything about your playstyle, strengths, or areas for improvement!` 
      }]);
      setSuggestions(personalizedSuggestions);
    }
  }, [isOpen, context.totalGamesAnalyzed, summonerName, STORAGE_KEY, EXPIRATION_TIME]);

  // Save history on update
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        timestamp: Date.now(),
        messages,
        suggestions
      }));
    }
  }, [messages, suggestions, summonerName, STORAGE_KEY]);

  const handleClearChat = () => {
    localStorage.removeItem(STORAGE_KEY);
    const personalizedSuggestions = generatePersonalizedSuggestions(context);
    setMessages([{ 
      role: 'model', 
      content: `Hi! I'm your AI Coach. I've analyzed ${context.totalGamesAnalyzed || 0} of your recent games. Ask me anything about your playstyle, strengths, or areas for improvement!` 
    }]);
    setSuggestions(personalizedSuggestions);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-2 sm:p-4 transition-all">
      <div className="bg-white/95 dark:bg-slate-900/80 backdrop-blur-xl w-full max-w-3xl h-[95vh] sm:h-[85vh] rounded-2xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-200/50 dark:border-white/10">
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200/50 dark:border-white/5 flex justify-between items-center shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10 dark:shadow-cyan-500/20 p-1.5 sm:p-2 overflow-hidden shrink-0">
              <img src="/lol.svg" alt="AI Coach" className="w-full h-full object-contain invert dark:invert-0 brightness-150 grayscale opacity-90 transition-all dark:opacity-100 dark:brightness-100 dark:grayscale-0" />
            </div>
            <span>AI Coach: {summonerName}</span>
          </h2>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleClearChat}
              className="text-xs sm:text-sm text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors px-2 py-1 sm:px-3 sm:py-1.5 rounded-full border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500"
            >
              Clear Chat
            </button>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors p-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-7 sm:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8 bg-transparent">
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
            >
              <div className={`flex max-w-[92%] sm:max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 sm:gap-3`}>
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm overflow-hidden ${
                  msg.role === 'user' 
                    ? 'bg-cyan-600' 
                    : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-cyan-500/30 p-1.5 sm:p-2'
                }`}>
                  {msg.role === 'user' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <img src="/lol.svg" alt="AI Coach" className="w-full h-full object-contain invert dark:invert-0 brightness-150 grayscale opacity-90 transition-all dark:opacity-100 dark:brightness-100 dark:grayscale-0" />
                  )}
                </div>
                <div 
                  className={`rounded-2xl sm:rounded-3xl px-4 py-3 sm:px-6 sm:py-4 shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-cyan-600 dark:bg-cyan-600/90 text-white rounded-br-sm' 
                      : 'bg-gray-100/80 dark:bg-slate-800/80 text-gray-800 dark:text-gray-100 rounded-bl-sm border border-gray-200/50 dark:border-white/5'
                  }`}
                >
                  {msg.role === 'model' ? (
                    <>
                      <div className="prose dark:prose-invert prose-sm sm:prose-base max-w-none prose-p:leading-relaxed prose-strong:text-cyan-700 dark:prose-strong:text-cyan-400 prose-strong:font-semibold">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      {/* Feedback buttons */}
                      {msg.interactionId && (
                        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                          {msg.feedback === 'positive' ? (
                            <span className="text-green-600 dark:text-green-400 text-sm flex items-center gap-1">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Helpful
                            </span>
                          ) : msg.feedback === 'negative' ? (
                            <span className="text-red-600 dark:text-red-400 text-sm flex items-center gap-1">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              Not helpful
                            </span>
                          ) : (
                            <>
                              <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">Was this helpful?</span>
                              <button
                                onClick={() => handleFeedback(msg.interactionId, 'positive', msg.timestamp)}
                                className="text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors p-1 rounded hover:bg-green-50 dark:hover:bg-green-900/20"
                                title="This was helpful"
                              >
                                👍
                              </button>
                              <button
                                onClick={() => handleFeedback(msg.interactionId, 'negative', msg.timestamp)}
                                className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="This was not helpful"
                              >
                                👎
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start animate-fade-in-up pb-2">
              <div className="flex max-w-[92%] sm:max-w-[85%] flex-row items-end gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-cyan-500/30 flex items-center justify-center shrink-0 shadow-sm p-1.5 sm:p-2 overflow-hidden">
                  <img src="/lol.svg" alt="AI Coach" className="w-full h-full object-contain invert dark:invert-0 brightness-150 grayscale opacity-90 transition-all dark:opacity-100 dark:brightness-100 dark:grayscale-0" />
                </div>
                <div className="bg-gray-100/80 dark:bg-slate-800/80 px-4 py-4 sm:px-6 sm:py-5 rounded-2xl sm:rounded-3xl rounded-bl-sm border border-gray-200/50 dark:border-white/5 shadow-sm flex items-center gap-1.5 h-[48px] sm:h-[56px]">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-cyan-500/60 dark:bg-cyan-400/80 rounded-full typing-dot"></div>
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-cyan-500/60 dark:bg-cyan-400/80 rounded-full typing-dot"></div>
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-cyan-500/60 dark:bg-cyan-400/80 rounded-full typing-dot"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Questions */}
        {suggestions.length > 0 && !loading && (
          <div className="px-4 py-3 sm:px-6 sm:py-3 bg-transparent border-t border-gray-200/50 dark:border-white/5 shrink-0">
            <div className="flex overflow-x-auto sm:flex-wrap gap-2 pb-1 scrollbar-hide snap-x">
              {suggestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(q)}
                  className="shrink-0 snap-start px-3 py-1.5 sm:px-4 sm:py-1.5 bg-transparent border border-cyan-500/40 dark:border-cyan-400/30 text-cyan-700 dark:text-cyan-300 text-sm rounded-full hover:bg-cyan-500 hover:text-white dark:hover:bg-cyan-400 dark:hover:text-slate-900 transition-all duration-300 shadow-sm hover:scale-[1.02] active:scale-95"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 sm:p-5 pb-5 sm:pb-5 border-t border-gray-200/50 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex gap-2 sm:gap-3 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage(input)}
              placeholder="Ask a question about this player..."
              className="flex-1 bg-white/80 dark:bg-slate-800/80 border border-gray-200/50 dark:border-white/10 rounded-2xl px-4 py-3 sm:px-4 sm:py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 dark:text-white placeholder-gray-400 shadow-sm text-sm transition-all"
              disabled={loading}
            />
            <button
              onClick={() => handleSendMessage(input)}
              disabled={loading || !input.trim()}
              className="bg-cyan-600 hover:bg-cyan-500 text-white p-3 sm:px-5 sm:py-3 rounded-2xl shadow-sm hover:shadow-cyan-500/25 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none shrink-0 flex items-center justify-center transform active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
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
