import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { IapProvider } from './src/contexts/IapContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <IapProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </IapProvider>
    </SafeAreaProvider>
  );
}
