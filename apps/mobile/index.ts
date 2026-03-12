import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import App from './App';

// Required for LiveKit WebRTC to work on React Native
// Guard: native module may not be linked in Expo Go / simulator builds.
// Module name is split to prevent Metro from statically bundling it.
try {
  const _lkRN = ['@livekit', 'react-native'].join('/');
  const { registerGlobals } = require(_lkRN);
  registerGlobals();
} catch (e) {
  console.warn('[LiveKit] Native module not available, voice channels will be disabled:', (e as Error).message);
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
