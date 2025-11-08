import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AnalysisPage.css';

const AnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Initializing analysis...');

  useEffect(() => {
    const statuses = [
      'Initializing analysis...',
      'Connecting to XAI model...',
      'Analyzing social sentiment...',
      'Mapping stock correlations...',
      'Calculating impact scores...',
      'Generating insights...',
      'Finalizing results...',
    ];

    let currentStatus = 0;
    const interval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + Math.random() * 15;
        if (newProgress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            navigate('/dashboard');
          }, 500);
          return 100;
        }
        return Math.min(newProgress, 100);
      });

      if (currentStatus < statuses.length - 1 && progress > (currentStatus + 1) * (100 / statuses.length)) {
        currentStatus++;
        setStatus(statuses[currentStatus]);
      }
    }, 300);

    return () => clearInterval(interval);
  }, [navigate, progress]);

  return (
    <div className="analysis-page">
      <div className="analysis-container">
        <div className="analysis-logo">
          <svg viewBox="0 0 24 24" className="logo-icon">
            <g>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor" />
            </g>
          </svg>
        </div>
        <h1 className="analysis-title">ANALYSING...</h1>
        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="progress-text">{Math.round(progress)}%</span>
        </div>
        <p className="analysis-status">{status}</p>
        <div className="analysis-animation">
          <div className="pulse-circle"></div>
          <div className="pulse-circle"></div>
          <div className="pulse-circle"></div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisPage;
