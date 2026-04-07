import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { LogProvider } from './src/context/LogContext';
import { logger } from './src/lib/logger';

export default function App() {
  const sessionIdRef = useRef(
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const TAG = 'AppRoot';
    const previousGlobalHandler =
      (global as any)?.ErrorUtils?.getGlobalHandler?.() ?? null;
    logger.info(TAG, 'session started', {
      sessionId: sessionIdRef.current,
      initialAppState: appStateRef.current,
    });

    if ((global as any)?.ErrorUtils?.setGlobalHandler) {
      (global as any).ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
        logger.error(TAG, 'global JS error', {
          sessionId: sessionIdRef.current,
          isFatal: !!isFatal,
          name: error?.name,
          message: error?.message,
          stack: error?.stack,
        });
        if (typeof previousGlobalHandler === 'function') {
          previousGlobalHandler(error, isFatal);
        }
      });
    }

    const sub = AppState.addEventListener('change', (nextState) => {
      logger.info(TAG, 'app state changed', {
        sessionId: sessionIdRef.current,
        from: appStateRef.current,
        to: nextState,
      });
      appStateRef.current = nextState;
    });

    return () => {
      logger.info(TAG, 'session ending (App unmount)', {
        sessionId: sessionIdRef.current,
        finalAppState: appStateRef.current,
      });
      if ((global as any)?.ErrorUtils?.setGlobalHandler) {
        (global as any).ErrorUtils.setGlobalHandler(
          previousGlobalHandler ?? ((err: any) => {
            throw err;
          })
        );
      }
      sub.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <LogProvider>
        <StatusBar style="light" backgroundColor="#0a0f1e" />
        <AppNavigator />
      </LogProvider>
    </SafeAreaProvider>
  );
}
