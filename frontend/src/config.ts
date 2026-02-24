import Constants from 'expo-constants';

// Read API URL from app.json
export const API_BASE = Constants.expoConfig.extra.API_URL;

// Debugging: check if URL is loaded correctly
console.log('Using backend URL:', API_BASE);
