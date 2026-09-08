import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { IapProvider } from './src/contexts/IapContext';
import { getMixpanel } from './src/lib/mixpanel';

export default function App() {
  useEffect(() => {
    // Initialise Mixpanel and fire app_opened on launch
    getMixpanel().then((mp) => {
      mp.track("app_opened", { first_open: false });
    });
  }, []);

  return (
    <SafeAreaProvider>
      <IapProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </IapProvider>
    </SafeAreaProvider>
  );
}
