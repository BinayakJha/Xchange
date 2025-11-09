// Authentication API service

export interface AuthResponse {
  success: boolean;
  user?: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
  token?: string;
  error?: string;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  displayName?: string;
  avatar?: string;
  createdAt?: string;
}

// Get stored token from localStorage
export const getToken = (): string | null => {
  return localStorage.getItem('authToken');
};

// Store token in localStorage
export const setToken = (token: string): void => {
  localStorage.setItem('authToken', token);
};

// Remove token from localStorage
export const removeToken = (): void => {
  localStorage.removeItem('authToken');
};

// Get authorization header
export const getAuthHeader = (): { Authorization: string } | {} => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Register new user
export const register = async (
  username: string,
  password: string,
  email?: string,
  displayName?: string
): Promise<AuthResponse> => {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password, email, displayName }),
    });

    const data = await response.json();

    if (data.success && data.token) {
      setToken(data.token);
      return data;
    }

    return { success: false, error: data.error || 'Registration failed' };
  } catch (error: any) {
    console.error('Registration error:', error);
    return { success: false, error: error.message || 'Registration failed' };
  }
};

// Login user
export const login = async (username: string, password: string): Promise<AuthResponse> => {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (data.success && data.token) {
      setToken(data.token);
      return data;
    }

    return { success: false, error: data.error || 'Login failed' };
  } catch (error: any) {
    console.error('Login error:', error);
    return { success: false, error: error.message || 'Login failed' };
  }
};

// Logout user
export const logout = (): void => {
  removeToken();
};

// Get current user
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const token = getToken();
    if (!token) return null;

    const response = await fetch('/api/auth/me', {
      headers: {
        ...getAuthHeader(),
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        removeToken();
      }
      return null;
    }

    const data = await response.json();
    return data.success ? data.user : null;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  return getToken() !== null;
};
