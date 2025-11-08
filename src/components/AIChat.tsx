import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import './AIChat.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tradeExecuted?: {
    ticker: string;
    action: 'buy' | 'sell';
    quantity: number;
    price: number;
    total: number;
  };
}

const AIChat: React.FC = () => {
  const { watchlist, positions, addPosition, removePosition } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your AI trading assistant. I can help you analyze stocks, execute paper trades, and answer questions about the market. Try saying things like:\n\n• 'Buy $1000 worth of AAPL'\n• 'What's the sentiment on TSLA?'\n• 'Show me my positions'\n• 'Sell 10 shares of NVDA'\n\nHow can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const executeTrade = async (ticker: string, action: 'buy' | 'sell', quantity: number, price: number) => {
    try {
      // Validate price is reasonable (not zero or negative)
      if (!price || price <= 0) {
        return { success: false, error: `Invalid price: $${price}. Cannot execute trade.` };
      }

      // For buy orders, validate we have enough information
      if (action === 'buy' && (!quantity || quantity <= 0)) {
        return { success: false, error: `Invalid quantity: ${quantity}. Cannot execute trade.` };
      }
      
      if (action === 'buy') {
        // Check if position already exists
        const existingPosition = positions.find(p => p.ticker === ticker && p.type === 'stock');
        
        if (existingPosition) {
          // Update existing position (average price)
          const totalCost = (existingPosition.quantity * existingPosition.entryPrice) + (quantity * price);
          const totalQuantity = existingPosition.quantity + quantity;
          const avgPrice = totalCost / totalQuantity;
          
          // Remove old position and add updated one
          removePosition(existingPosition.id);
          const newPosition = {
            id: `trade-${Date.now()}`,
            ticker,
            quantity: totalQuantity,
            entryPrice: avgPrice,
            currentPrice: price,
            pnl: 0,
            pnlPercent: 0,
            type: 'stock' as const,
          };
          addPosition(newPosition);
          return { success: true, position: newPosition };
        } else {
          // Create new position
          const position = {
            id: `trade-${Date.now()}`,
            ticker,
            quantity,
            entryPrice: price,
            currentPrice: price,
            pnl: 0,
            pnlPercent: 0,
            type: 'stock' as const,
          };
          addPosition(position);
          return { success: true, position };
        }
      } else {
        // Find position to sell
        const position = positions.find(p => p.ticker === ticker && p.type === 'stock');
        if (!position) {
          return { success: false, error: `No position found for ${ticker}` };
        }
        
        if (quantity >= position.quantity) {
          // Sell entire position
          removePosition(position.id);
          return { success: true, position };
        } else {
          // Partial sell - update position
          removePosition(position.id);
          const remainingQuantity = position.quantity - quantity;
          const newPosition = {
            ...position,
            id: `trade-${Date.now()}`,
            quantity: remainingQuantity,
          };
          addPosition(newPosition);
          return { success: true, position: { ...position, quantity } };
        }
      }
    } catch (error) {
      console.error('Error executing trade:', error);
      return { success: false, error: 'Failed to execute trade' };
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          context: {
            watchlist: watchlist.map(w => w.ticker),
            positions: positions.map(p => ({
              ticker: p.ticker,
              quantity: p.quantity,
              entryPrice: p.entryPrice,
              currentPrice: p.currentPrice,
              pnl: p.pnl,
              type: p.type,
            })),
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      
      let assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.response || 'I apologize, but I encountered an error processing your request.',
        timestamp: new Date(),
      };

      // Check if AI wants to execute multiple trades (diversification)
      if (data.tradeActions && Array.isArray(data.tradeActions)) {
        const executedTrades: Array<{ ticker: string; action: 'buy' | 'sell'; quantity: number; price: number; total: number }> = [];
        const failedTrades: Array<{ ticker: string; error: string }> = [];
        
        // Execute all trades
        for (const trade of data.tradeActions) {
          const { ticker, action, quantity, price } = trade;
          const tradeResult = await executeTrade(ticker, action, quantity, price);
          
          if (tradeResult.success) {
            executedTrades.push({
              ticker,
              action,
              quantity,
              price,
              total: quantity * price,
            });
          } else {
            failedTrades.push({
              ticker,
              error: tradeResult.error || 'Unknown error',
            });
          }
        }
        
        // Build summary message
        let summary = data.response + '\n\n';
        
        if (executedTrades.length > 0) {
          summary += '✅ Executed Trades:\n';
          executedTrades.forEach(trade => {
            summary += `  • ${trade.action.toUpperCase()} ${trade.quantity} ${trade.ticker} @ $${trade.price.toFixed(2)} ($${trade.total.toFixed(2)})\n`;
          });
        }
        
        if (failedTrades.length > 0) {
          summary += '\n❌ Failed Trades:\n';
          failedTrades.forEach(trade => {
            summary += `  • ${trade.ticker}: ${trade.error}\n`;
          });
        }
        
        assistantMessage.content = summary;
        
        // Show first executed trade in badge (for UI display)
        if (executedTrades.length > 0) {
          assistantMessage.tradeExecuted = executedTrades[0];
        }
      }
      // Check if AI wants to execute a single trade
      else if (data.tradeAction) {
        const { ticker, action, quantity, price } = data.tradeAction;
        const tradeResult = await executeTrade(ticker, action, quantity, price);
        
        if (tradeResult.success) {
          assistantMessage.tradeExecuted = {
            ticker,
            action,
            quantity,
            price,
            total: quantity * price,
          };
          assistantMessage.content = data.response + `\n\n✅ Trade executed: ${action.toUpperCase()} ${quantity} shares of ${ticker} at $${price.toFixed(2)} (Total: $${(quantity * price).toFixed(2)})`;
        } else {
          assistantMessage.content = data.response + `\n\n❌ Trade failed: ${tradeResult.error || 'Unable to execute trade'}`;
        }
      }

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="ai-chat">
      <div className="chat-header">
        <div className="chat-header-info">
          <h2>AI Trading Assistant</h2>
          <p>Ask me anything about stocks, trading, or execute paper trades</p>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="message-avatar">
              {message.role === 'user' ? (
                <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              )}
            </div>
            <div className="message-content">
              <div className="message-text">{message.content}</div>
              {message.tradeExecuted && (
                <div className="trade-executed-badge">
                  <span className="trade-icon">💰</span>
                  <span>
                    {message.tradeExecuted.action.toUpperCase()} {message.tradeExecuted.quantity} {message.tradeExecuted.ticker} @ ${message.tradeExecuted.price.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="message-time">{formatTime(message.timestamp)}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">
            <div className="message-avatar">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder="Ask me anything... (e.g., 'Buy $1000 worth of AAPL')"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          rows={1}
          disabled={isLoading}
        />
        <button
          className="chat-send-button"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default AIChat;

