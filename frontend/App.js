import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { ExpoRoot } from 'expo-router';

// This file now acts as a bridge to ensure the tactical app/ folder is loaded.
// It removes the old, slow test logic and enables the optimized GhostRecon suite.

export default function App() {
  const ctx = require.context('./app');
  return <ExpoRoot context={ctx} />;
}
