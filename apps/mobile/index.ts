import 'react-native-gesture-handler';
import { registerGlobals } from '@livekit/react-native';
import { registerRootComponent } from 'expo';

import App from './App';

// Required for LiveKit WebRTC to work on React Native
registerGlobals();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
