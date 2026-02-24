import { BASE_URL } from './config';

// Example: Login function
export async function loginUser(identifier, password) {
  try {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Login failed');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Login error:", error.message);
    throw error;
  }
}

// Example: Get current user
export async function getCurrentUser(token) {
  try {
    const response = await fetch(`${BASE_URL}/auth/me`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error("Failed to fetch user");
    }
    return await response.json();
  } catch (error) {
    console.error("Get user error:", error.message);
    throw error;
  }
}
