import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('checkpoint_token'));
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const savedToken = localStorage.getItem('checkpoint_token');
    if (!savedToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.get<{ user: User }>('/api/auth/me');
      setUser(res.user);
      connectSocket(savedToken);
    } catch {
      localStorage.removeItem('checkpoint_token');
      setUser(null);
      setToken(null);
      disconnectSocket();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('checkpoint_token', newToken);
    setToken(newToken);
    setUser(newUser);
    connectSocket(newToken);
  };

  const logout = () => {
    localStorage.removeItem('checkpoint_token');
    setToken(null);
    setUser(null);
    disconnectSocket();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
