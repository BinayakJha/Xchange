import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import SectorHeatmap from './SectorHeatmap';
import { Stock } from '../types';
import './AIChat.css';

type TradeSummary = {
  ticker: string;
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  assetType: 'stock' | 'crypto' | 'option';
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tradeExecuted?: TradeSummary;
  tradeSummary?: string[];
  tradeErrors?: string[];
  heatmap?: {
    sector: string;
    stocks: Stock[];
  };
}

const AIChat: React.FC = () => {
  const { watchlist, paperPositions, paperCash, executePaperTrade } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-intro',
      role: 'assistant',
      content:
        "Hi! I'm your AI market assistant. I can answer questions, analyze sentiment, visualize heatmaps, and execute paper trades for stocks, crypto, or options. Try commands such as:\n\n• 'What's the sentiment on TSLA?'\n• 'Show me a heatmap of the technology sector'\n• 'Buy $3,000 of AAPL'\n• 'Sell 2 contracts of NVDA 500C expiring next week'\n• 'Put $5k to work wherever you think best'\n\nHow can I help you today?",
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

  const formatTradeSummary = (trade: TradeSummary) => {
    const units =
      trade.assetType === 'option'
        ? 'contract(s)'
        : trade.assetType === 'crypto'
          ? 'token(s)'
          : 'share(s)';
    return `${trade.action.toUpperCase()} ${trade.quantity} ${units} of ${trade.ticker} @ $${trade.price.toFixed(
      2,
    )} (Total: $${trade.total.toFixed(2)})`;
  };

  const executeTradeAction = async (tradeAction: any) => {
    const ticker = (tradeAction.ticker || '').toString().toUpperCase();
    const action: 'buy' | 'sell' = (tradeAction.action || 'buy').toString().toLowerCase() === 'sell' ? 'sell' : 'buy';
    const assetType = (tradeAction.assetType || 'stock').toString().toLowerCase();

    const quantity = Number(tradeAction.quantity);
    const price = Number(tradeAction.price);
    const amount = Number(tradeAction.amount);

    const normalizedOptionType: 'PUT' | 'CALL' =
      tradeAction.optionDetails &&
        tradeAction.optionDetails.optionType &&
        tradeAction.optionDetails.optionType.toString().toUpperCase() === 'PUT'
        ? 'PUT'
        : 'CALL';

    const optionDetails = tradeAction.optionDetails
      ? {
        optionType: normalizedOptionType,
        strikePrice: Number(tradeAction.optionDetails.strikePrice),
        expirationDate: tradeAction.optionDetails.expirationDate,
      }
      : undefined;

    const result = await executePaperTrade({
      ticker,
      action,
      assetType: assetType === 'crypto' ? 'crypto' : assetType === 'option' ? 'option' : 'stock',
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : undefined,
      price: Number.isFinite(price) && price > 0 ? price : undefined,
      amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
      optionDetails,
    });

    if (result.success && result.trade) {
      const trade: TradeSummary = {
        ticker: result.trade.symbol,
        action: result.trade.action === 'SELL' ? 'sell' : 'buy',
        quantity: result.trade.quantity,
        price: result.trade.price,
        total: result.trade.total,
        assetType: result.trade.assetType,
      };
      window.dispatchEvent(new CustomEvent('switchToPapertrade'));
      return { success: true, trade, summary: formatTradeSummary(trade) };
    }

    return { success: false, error: result.error || 'Trade failed' };
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
            watchlist: watchlist.map((w) => w.ticker),
            positions: paperPositions.map((p) => ({
              ticker: p.symbol,
              quantity: p.quantity,
              averagePrice: p.averagePrice,
              currentPrice: p.currentPrice,
              assetType: p.assetType,
            })),
            buyingPower: paperCash,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.response || 'I apologize, but I encountered an error processing your request.',
        timestamp: new Date(),
      };

      const executedSummaries: string[] = [];
      const failedSummaries: string[] = [];
      const executedTrades: TradeSummary[] = [];

      const processTradeAction = async (action: any) => {
        const result = await executeTradeAction(action);
        if (result.success && result.trade && result.summary) {
          executedSummaries.push(result.summary);
          executedTrades.push(result.trade);
        } else if (result.error) {
          const label = (action.ticker || action.symbol || 'Unknown').toString().toUpperCase();
          failedSummaries.push(`${label}: ${result.error}`);
        }
      };

      if (Array.isArray(data.tradeActions) && data.tradeActions.length > 0) {
        for (const action of data.tradeActions) {
          await processTradeAction(action);
        }
      } else if (data.tradeAction) {
        await processTradeAction(data.tradeAction);
      }

      let summaryText = data.response || '';
      if (executedSummaries.length > 0) {
        summaryText += '\n\n✅ Executed Trades:\n' + executedSummaries.map((s) => `  • ${s}`).join('\n');
        assistantMessage.tradeSummary = executedSummaries;
        assistantMessage.tradeExecuted = executedTrades[0];
      }
      if (failedSummaries.length > 0) {
        summaryText += '\n\n⚠️ Unable to execute:\n' + failedSummaries.map((s) => `  • ${s}`).join('\n');
        assistantMessage.tradeErrors = failedSummaries;
      }

      assistantMessage.content = summaryText.trim();

      if (data.heatmap) {
        assistantMessage.heatmap = data.heatmap;
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
          <p>Ask about the market, explore heatmaps, or let me build a paper portfolio for you.</p>
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

              {message.heatmap && (
                <div className="heatmap-container">
                  <SectorHeatmap sector={message.heatmap.sector} stocks={message.heatmap.stocks} />
                </div>
              )}

              {message.tradeSummary && message.tradeSummary.length > 0 && (
                <div className="trade-summary">
                  <h4>Executed Trades</h4>
                  <ul>
                    {message.tradeSummary.map((summary, index) => (
                      <li key={`${message.id}-trade-${index}`}>{summary}</li>
                    ))}
                  </ul>
                </div>
              )}

              {message.tradeErrors && message.tradeErrors.length > 0 && (
                <div className="trade-errors">
                  <h4>Execution Issues</h4>
                  <ul>
                    {message.tradeErrors.map((summary, index) => (
                      <li key={`${message.id}-error-${index}`}>{summary}</li>
                    ))}
                  </ul>
                </div>
              )}

              {message.tradeExecuted && (
                <div className="trade-executed-badge">
                  <span className="trade-icon">💰</span>
                  <span>{formatTradeSummary(message.tradeExecuted)}</span>
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
              <div className="message-typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Ask about the market, request a heatmap, or tell me how you want to invest..."
          rows={3}
        />
        <div className="chat-actions">
          <button className="send-button" onClick={handleSend} disabled={isLoading || !input.trim()}>
            {isLoading ? 'Thinking...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;

