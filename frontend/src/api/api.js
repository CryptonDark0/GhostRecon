import { BASE_URL } from './config';

export const auth = {
  login: async (identifier, password) => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    if (!response.ok) throw new Error("Login failed");
    return await response.json();
  },
  getMe: async (token) => {
    const response = await fetch(`${BASE_URL}/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Failed to fetch user");
    return await response.json();
  },
  registerAnonymous: async () => {
    const response = await fetch(`${BASE_URL}/auth/register/anonymous`, { method: 'POST' });
    if (!response.ok) throw new Error("Failed to register anonymous");
    return await response.json();
  },
  // Add other endpoints similarly...
};
