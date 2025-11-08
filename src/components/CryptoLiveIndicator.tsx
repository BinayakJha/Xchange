import React from 'react';
import './CryptoLiveIndicator.css';

const CryptoLiveIndicator: React.FC = () => {
  return (
    <div className="crypto-live-indicator" title="Real-time crypto prices via WebSocket">
      <span className="live-dot"></span>
      <span className="live-text">LIVE</span>
    </div>
  );
};

export default CryptoLiveIndicator;

