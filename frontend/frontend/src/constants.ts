// GhostRecon Theme Constants
export const COLORS = {
  void_black: '#050505',
  gunmetal: '#121212',
  armour_grey: '#1F1F1F',
  terminal_green: '#00FF41',
  alert_amber: '#FFB000',
  critical_red: '#FF3B30',
  ghost_white: '#E5E5E5',
  stealth_grey: '#525252',
  muted_text: '#A3A3A3',
  border_subtle: '#333333',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export const API_BASE = `${BACKEND_URL}/api`;
