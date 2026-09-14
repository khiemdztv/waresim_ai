import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { queryRouter } from '@/lib/rag/query-router';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Xin chào! Tôi là AI Operations Agent (Temporal RAG). Bạn có thể hỏi tôi về lượng tồn kho hiện tại, lịch sử sự kiện, hoặc các luồng vận hành của hệ thống.',
      sender: 'bot',
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      // Call actual RAG logic
      const responseText = await queryRouter.processQuery(userMessage.text);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        sender: 'bot',
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 p-4 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700 hover:scale-105 transition-all duration-300 z-50",
          isOpen ? "scale-0 opacity-0 pointer-events-none" : "scale-100 opacity-100"
        )}
      >
        <Bot size={28} />
      </button>

      {/* Chat Window */}
      <div
        className={cn(
          "fixed bottom-6 right-6 w-[400px] h-[600px] bg-background/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-500 z-50 origin-bottom-right",
          isOpen ? "scale-100 opacity-100" : "scale-50 opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Bot size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Agentic Operations AI</h3>
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Connected to RAG
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex max-w-[85%] animate-in slide-in-from-bottom-2",
                msg.sender === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div 
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-auto shadow-md",
                  msg.sender === 'user' ? "bg-white/10 ml-2" : "bg-blue-600/20 text-blue-400 mr-2 border border-blue-500/30"
                )}
              >
                {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div
                className={cn(
                  "p-3 rounded-2xl text-sm leading-relaxed",
                  msg.sender === 'user' 
                    ? "bg-blue-600 text-white rounded-br-sm" 
                    : "bg-white/5 border border-white/10 rounded-bl-sm"
                )}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex max-w-[85%] mr-auto items-end animate-in fade-in">
               <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 mr-2 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                  <Bot size={16} />
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 rounded-bl-sm flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/10 bg-black/20">
          <form onSubmit={handleSendMessage} className="relative flex items-center">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Hỏi về hệ thống (VD: Kệ A còn bao nhiêu?)"
              className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-4 pr-12 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-sm placeholder:text-gray-500"
            />
            <button 
              type="submit"
              disabled={!inputValue.trim()}
              className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-white/10 disabled:text-gray-500 text-white rounded-full transition-colors"
            >
              <Send size={16} className={cn("translate-x-[-1px]", inputValue.trim() ? "translate-x-0" : "")} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
