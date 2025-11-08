import React, { useState } from 'react';
import Header from '../components/Header';
import Feed from '../components/Feed';
import SentimentSidebar from '../components/SentimentSidebar';
import UnusualFlowFeed from '../components/UnusualFlowFeed';
import Papertrade from '../components/Papertrade';
import './DashboardPage.css';

const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'feed' | 'unusual-flow' | 'papertrade'>('feed');

  return (
    <div className="dashboard-page">
      <Header />
      <div className="dashboard-content">
        <div className="dashboard-layout">
          <aside className="dashboard-sidebar left">
            <SentimentSidebar />
          </aside>

          <main className="dashboard-main">
            <div className="dashboard-tabs">
              <button
                className={`tab-button ${activeTab === 'feed' ? 'active' : ''}`}
                onClick={() => setActiveTab('feed')}
              >
                Feed
              </button>
              <button
                className={`tab-button ${activeTab === 'unusual-flow' ? 'active' : ''}`}
                onClick={() => setActiveTab('unusual-flow')}
              >
                Unusual Flow
              </button>
              <button
                className={`tab-button ${activeTab === 'papertrade' ? 'active' : ''}`}
                onClick={() => setActiveTab('papertrade')}
              >
                Papertrade
              </button>
            </div>

            {activeTab === 'feed' && <Feed />}
            {activeTab === 'unusual-flow' && <UnusualFlowFeed />}
            {activeTab === 'papertrade' && <Papertrade />}
          </main>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

