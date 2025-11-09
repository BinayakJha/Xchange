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
      <div className="galaxy-background">
        <div className="stars"></div>
        <div className="stars2"></div>
        <div className="stars3"></div>
        <div className="nebula"></div>
      </div>
      <div className="landing-container">
        {/* Left Section - Large X Logo */}
        <div className="landing-left">
          <div className="x-hero">
            <div className="x-hero-background" aria-hidden="true"></div>
            <svg
              viewBox="0 0 24 24"
              className="x-hero-backdrop"
              aria-hidden="true"
            >
              <g>
                <path
                  d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
                  fill="currentColor"
                />
              </g>
            </svg>
            <div className="x-hero-inner">
              {/* Foreground X Logo */}
              <svg viewBox="0 0 24 24" className="x-hero-logo">
                <g>
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor" />
                </g>
              </svg>
              <div className="x-hero-text">
                <h1 className="x-change-title">CHANGE</h1>
                <div className="x-tagline">
                  <div>WHERE MARKET CHATTER BECOMES</div>
                  <div>MARKET INSIGHT.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section - Form Content */}
        <div className="landing-right">
          <div className="landing-content-wrapper">
            <h1 className="landing-header">Happening now</h1>
            <h2 className="landing-subheader">Join today.</h2>

            <form onSubmit={handleSubmit} className="auth-form">
              {error && (
                <div className="error-message">
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

            <p className="legal-text">
              By signing up, you agree to the{' '}
              <a href="#" className="legal-link">Terms of Service</a> and{' '}
              <a href="#" className="legal-link">Privacy Policy</a>, including{' '}
              <a href="#" className="legal-link">Cookie Use</a>.
            </p>

            <div className="auth-switch">
              <p className="auth-switch-text">
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
