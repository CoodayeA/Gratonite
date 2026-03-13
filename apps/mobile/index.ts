import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import App from './App';

// Required for LiveKit WebRTC to work on React Native
// Wrapped in try/catch — native module unavailable in Expo Go / simulator
try {
  const { registerGlobals } = require('@livekit/react-native');
  registerGlobals();
} catch {
  // LiveKit native module not linked — voice channels will be unavailable
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
