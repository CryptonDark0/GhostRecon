import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from './config';

const TOKEN_KEY = 'ghostrecon_token';
const USER_KEY = 'ghostrecon_user';

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getUser(): Promise<any | null> {
  const u = await AsyncStorage.getItem(USER_KEY);
  return u ? JSON.parse(u) : null;
}

export async function setUser(user: any): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearAuth(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function apiCall(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  console.log('API Request URL:', `${API_BASE}${endpoint}`);
  console.log('Request options:', options);

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

    const text = await res.text();
    console.log('Raw response:', text);

    if (!res.ok) {
      let errMsg = 'Request failed';
      try {
        const parsed = JSON.parse(text);
        errMsg = parsed.detail || parsed.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    return JSON.parse(text);
  } catch (error: any) {
    console.error('API Error:', error.message);
    throw error;
  }
}
