// AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load token and user from storage
  useEffect(() => {
    const loadAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        if (storedToken) {
          setToken(storedToken);
          const me = await auth.getMe(storedToken);
          setUser(me);
        }
      } catch (error) {
        console.log('Failed to load auth', error);
      } finally {
        setLoading(false);
      }
    };
    loadAuth();
  }, []);

  // Save token to storage
  const saveToken = async (newToken) => {
    setToken(newToken);
    await AsyncStorage.setItem('token', newToken);
  };

  // Login
  const login = async (identifier, password) => {
    const data = await auth.login(identifier, password);
    await saveToken(data.token);
    const me = await auth.getMe(data.token);
    setUser(me);
    return me;
  };

  // Logout
  const logout = async () => {
    setUser(null);
    setToken(null);
    await AsyncStorage.removeItem('token');
  };

  // Anonymous login
  const loginAnonymous = async () => {
    const data = await auth.registerAnonymous();
    await saveToken(data.token);
    const me = await auth.getMe(data.token);
    setUser(me);
    return me;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        loginAnonymous,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use AuthContext
export const useAuth = () => useContext(AuthContext);
