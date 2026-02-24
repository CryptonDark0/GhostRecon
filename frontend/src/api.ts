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

  // Log for debugging
  console.log('API Request URL:', `${API_BASE}${endpoint}`);
  console.log('Request options:', options);

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

    // Read raw response text for debugging
    const text = await res.text();
    console.log('Raw response:', text);

    // Check if response is ok
    if (!res.ok) {
      let errMsg = 'Request failed';
      try {
        const parsed = JSON.parse(text);
        errMsg = parsed.detail || parsed.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    // Parse JSON safely
    return JSON.parse(text);
  } catch (error: any) {
    console.error('API Error:', error.message);
    throw error;
  }
}
