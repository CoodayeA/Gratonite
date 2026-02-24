import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants from 'expo-constants';

const appExtra = (Constants.expoConfig?.extra ?? {}) as {
  webAppProdUrl?: string;
  webAppLanUrl?: string;
};

const PROD_BASE_URL = appExtra.webAppProdUrl || 'https://gratonite.chat/app';
const DEV_BASE_URL = appExtra.webAppLanUrl || 'http://192.168.42.78:5173/app';

function getInitialUrl() {
  // Expo "development" bundle should default to local LAN for faster iteration.
  return __DEV__ ? DEV_BASE_URL : PROD_BASE_URL;
}

export default function App() {
  const webRef = useRef<any>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hadError, setHadError] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(getInitialUrl());
  const [urlMode, setUrlMode] = useState<'prod' | 'dev'>(__DEV__ ? 'dev' : 'prod');

  const sourceUri = useMemo(
    () => (urlMode === 'dev' ? DEV_BASE_URL : PROD_BASE_URL),
    [urlMode],
  );

  const navTo = (path: string) => {
    webRef.current?.injectJavaScript(`
      (function() {
        try { window.location.assign(${JSON.stringify(path)}); } catch (e) {}
      })();
      true;
    `);
  };

  const isAllowedAppUrl = (url: string) =>
    url.startsWith('https://gratonite.chat') || url.startsWith('http://192.168.42.78:5173');

  let WebViewComponent: any = null;
  try {
    // Lazy require avoids Node-side Expo config tooling importing native modules while reading app config.
    WebViewComponent = require('react-native-webview').WebView;
  } catch {
    WebViewComponent = null;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.shell}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Gratonite iOS</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {currentUrl || sourceUri}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.pill, urlMode === 'prod' && styles.pillActive]}
              onPress={() => {
                setUrlMode('prod');
                setHadError(false);
                setIsLoading(true);
              }}
            >
              <Text style={styles.pillText}>Prod</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, urlMode === 'dev' && styles.pillActive]}
              onPress={() => {
                setUrlMode('dev');
                setHadError(false);
                setIsLoading(true);
              }}
            >
              <Text style={styles.pillText}>LAN</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.toolbar}>
          <TouchableOpacity
            style={[styles.toolBtn, !canGoBack && styles.toolBtnDisabled]}
            disabled={!canGoBack}
            onPress={() => webRef.current?.goBack()}
          >
            <Text style={styles.toolBtnText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolBtn, !canGoForward && styles.toolBtnDisabled]}
            disabled={!canGoForward}
            onPress={() => webRef.current?.goForward()}
          >
            <Text style={styles.toolBtnText}>Forward</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={() => webRef.current?.reload()}>
            <Text style={styles.toolBtnText}>Reload</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={() => navTo('/notifications')}>
            <Text style={styles.toolBtnText}>Alerts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={() => navTo('/shop')}>
            <Text style={styles.toolBtnText}>Shop</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.webWrap}>
          {WebViewComponent ? (
          <WebViewComponent
            ref={webRef}
            source={{ uri: sourceUri }}
            style={styles.webview}
            originWhitelist={['https://*', 'http://*']}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            javaScriptEnabled
            domStorageEnabled
            allowsBackForwardNavigationGestures
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            setSupportMultipleWindows={false}
            pullToRefreshEnabled
            onOpenWindow={(event: any) => {
              const url = event.nativeEvent.targetUrl;
              if (!url) return;
              if (isAllowedAppUrl(url)) {
                webRef.current?.injectJavaScript(`window.location.assign(${JSON.stringify(url)}); true;`);
                return;
              }
              Linking.openURL(url).catch(() => {});
            }}
            onLoadStart={() => {
              setIsLoading(true);
              setHadError(false);
            }}
            onLoadEnd={() => setIsLoading(false)}
            onError={(syntheticEvent: any) => {
              setHadError(true);
              setIsLoading(false);
              if (__DEV__) {
                console.warn('WebView error', syntheticEvent.nativeEvent);
              }
            }}
            onHttpError={(syntheticEvent: any) => {
              setHadError(true);
              setIsLoading(false);
              if (__DEV__) {
                console.warn('WebView HTTP error', syntheticEvent.nativeEvent);
              }
            }}
            onNavigationStateChange={(navState: any) => {
              setCanGoBack(navState.canGoBack);
              setCanGoForward(navState.canGoForward);
              setCurrentUrl(navState.url);
            }}
            onShouldStartLoadWithRequest={(request: any) => {
              const url = request.url;
              if (url.startsWith('mailto:') || url.startsWith('tel:')) {
                Linking.openURL(url).catch(() => {});
                return false;
              }
              const allowed = isAllowedAppUrl(url);
              if (!allowed) {
                Linking.openURL(url).catch(() => {});
                return false;
              }
              return true;
            }}
          />
          ) : (
            <View style={styles.moduleErrorCard}>
              <Text style={styles.errorTitle}>WebView module unavailable</Text>
              <Text style={styles.errorCopy}>
                The mobile shell could not load <Text style={styles.inlineStrong}>react-native-webview</Text>.
                Re-run install and try again.
              </Text>
            </View>
          )}

          {isLoading && (
            <View style={styles.overlay}>
              <ActivityIndicator color="#8fd3ff" />
              <Text style={styles.overlayText}>Loading Gratonite…</Text>
            </View>
          )}

          {hadError && (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Connection issue</Text>
              <Text style={styles.errorCopy}>
                Could not load the app. Try switching between <Text style={styles.inlineStrong}>Prod</Text> and{' '}
                <Text style={styles.inlineStrong}>LAN</Text>, then press Reload.
              </Text>
              <View style={styles.errorActions}>
                <TouchableOpacity style={styles.errorBtn} onPress={() => { setHadError(false); setIsLoading(true); webRef.current?.reload(); }}>
                  <Text style={styles.errorBtnText}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.errorBtn} onPress={() => { setUrlMode((m: 'prod' | 'dev') => (m === 'prod' ? 'dev' : 'prod')); setHadError(false); setIsLoading(true); }}>
                  <Text style={styles.errorBtnText}>Switch URL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.errorBtn}
                  onPress={() => Alert.alert('Current URL', currentUrl || sourceUri)}
                >
                  <Text style={styles.errorBtnText}>Details</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#070d18',
  },
  shell: {
    flex: 1,
    backgroundColor: '#070d18',
  },
  header: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(8,12,20,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#eef4ff',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
    color: '#9eb1c9',
    fontSize: 11,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    borderWidth: 1,
    borderColor: 'rgba(121,223,255,0.2)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(121,223,255,0.05)',
  },
  pillActive: {
    backgroundColor: 'rgba(121,223,255,0.14)',
    borderColor: 'rgba(121,223,255,0.35)',
  },
  pillText: {
    color: '#dff3ff',
    fontSize: 11,
    fontWeight: '600',
  },
  toolbar: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'rgba(9,14,24,0.92)',
  },
  toolBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  toolBtnDisabled: {
    opacity: 0.35,
  },
  toolBtnText: {
    color: '#e4eefb',
    fontSize: 12,
    fontWeight: '600',
  },
  webWrap: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#050911',
  },
  webview: {
    flex: 1,
    backgroundColor: '#050911',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(5,9,17,0.35)',
  },
  overlayText: {
    color: '#dbe9ff',
    fontSize: 12,
  },
  errorCard: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10,16,28,0.95)',
    padding: 14,
    gap: 8,
  },
  moduleErrorCard: {
    margin: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10,16,28,0.95)',
    padding: 14,
    gap: 8,
  },
  errorTitle: {
    color: '#f3f7ff',
    fontSize: 14,
    fontWeight: '700',
  },
  errorCopy: {
    color: '#a7bad2',
    fontSize: 12,
    lineHeight: 18,
  },
  inlineStrong: {
    color: '#e9f2ff',
    fontWeight: '700',
  },
  errorActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  errorBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(121,223,255,0.22)',
    backgroundColor: 'rgba(121,223,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  errorBtnText: {
    color: '#def2ff',
    fontWeight: '600',
    fontSize: 12,
  },
});
