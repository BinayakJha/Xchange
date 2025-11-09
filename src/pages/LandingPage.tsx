import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import './LandingPage.css';

type StoredUser = {
  email: string;
  passwordHash: string;
};

const hashPassword = (password: string) => {
  try {
    return btoa(password);
  } catch {
    return password;
  }
};

const getStoredUsers = (): StoredUser[] => {
  try {
    const data = localStorage.getItem('authUsers');
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveUsers = (users: StoredUser[]) => {
  localStorage.setItem('authUsers', JSON.stringify(users));
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, setAuthenticated } = useApp();
  const [isSignup, setIsSignup] = useState<boolean>(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Please enter your email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const users = getStoredUsers();
      const passwordHash = hashPassword(password);

      if (isSignup) {
        const existingUser = users.find((user) => user.email === normalizedEmail);
        if (existingUser) {
          setError('An account with this email already exists. Please sign in.');
          return;
        }

        const updatedUsers = [...users, { email: normalizedEmail, passwordHash }];
        saveUsers(updatedUsers);

        setAuthenticated(true);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('authEmail', normalizedEmail);
        navigate('/watchlist');
      } else {
        const existingUser = users.find((user) => user.email === normalizedEmail);
        if (!existingUser) {
          setError('No account found with this email. Please sign up.');
          return;
        }

        if (existingUser.passwordHash !== passwordHash) {
          setError('Incorrect password. Please try again.');
          return;
        }

        setAuthenticated(true);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('authEmail', normalizedEmail);
        navigate('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignup((prev) => !prev);
    setEmail('');
    setPassword('');
    setError('');
  };

  return (
    <div className="landing-page">
      <div className="landing-container">
        <div className="landing-left">

          <div className="landing-logo">
          <svg viewBox="0 0 24 24" className="logo-icon">
            <g>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor" />
            </g>
          </svg>
          <span>Change</span>
          </div>

          <h1 className="landing-title">Happening now</h1>
          <h2 className="landing-subtitle">Join XChange today.</h2>
        </div>

        <div className="landing-right">
          <div className="landing-card">
            <h2 className="card-title">
              {isSignup ? 'Create your account' : 'Welcome back'}
            </h2>
            
            <form onSubmit={handleSubmit} className="auth-form">
              {error && (
                <div className="error-message" style={{ 
                  color: '#ef4444', 
                  fontSize: '14px', 
                  marginBottom: '16px',
                  padding: '8px',
                  backgroundColor: '#fee2e2',
                  borderRadius: '4px'
                }}>
                  {error}
                </div>
              )}

              <div className="form-group">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  required
                  disabled={loading}
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={loading}
              >
                {loading ? 'Please wait...' : (isSignup ? 'Create account' : 'Sign in')}
              </button>
            </form>

            <div className="auth-switch">
              <p>
                {isSignup ? 'Already have an account?' : "Don't have an account?"}
              </p>
              <button
                className="btn btn-secondary btn-full"
                onClick={toggleMode}
                type="button"
                disabled={loading}
              >
                {isSignup ? 'Sign in' : 'Sign up'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
