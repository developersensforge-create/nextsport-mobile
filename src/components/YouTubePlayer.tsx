import React, { useState, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Image, Text, Linking } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

interface YouTubePlayerProps {
  /** 11-char YouTube video ID (not the full URL) */
  videoId: string;
  /** Optional start time in seconds */
  startTime?: number;
  /** Original full URL — used for fallback external link */
  originalUrl?: string;
}

/**
 * Inline YouTube player using HTML injection + YouTube IFrame API error detection.
 *
 * Why html-inject instead of uri?
 * - Android WebView blocks youtube.com/embed via uri due to User-Agent detection (Error 153)
 * - Injecting raw HTML with an <iframe> inside a local document sidesteps the UA check
 * - baseUrl="https://www.youtube.com" makes the iframe treat itself as same-origin,
 *   which satisfies YouTube's referrer/origin policy without triggering embed blocks
 *
 * Error 152 / embed-not-allowed fallback:
 * - Some videos (especially Shorts) forbid embedding via iframe
 * - YouTube IFrame API fires onError(152) / onError(150) / onError(101) in these cases
 * - We relay that via postMessage → WebView onMessage → show thumbnail + external link
 */
export default function YouTubePlayer({ videoId, startTime = 0, originalUrl }: YouTubePlayerProps) {
  const [embedFailed, setEmbedFailed] = useState(false);

  const thumbnailUri = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  const watchUrl = originalUrl ?? `https://www.youtube.com/watch?v=${videoId}`;

  const embedSrc =
    `https://www.youtube.com/embed/${videoId}` +
    `?autoplay=1&playsinline=1&enablejsapi=1&start=${startTime}&rel=0&modestbranding=1`;

  // YouTube IFrame API error codes that mean "can't embed this video"
  // 2=bad params, 5=HTML5 error, 100=not found, 101/150/152=embed not allowed
  const playerHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body, html {
      margin: 0; padding: 0;
      width: 100%; height: 100%;
      background-color: #000;
      overflow: hidden;
    }
    iframe {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      border: none;
    }
  </style>
</head>
<body>
  <div id="player"></div>
  <script src="https://www.youtube.com/iframe_api"></script>
  <script>
    var player;
    function onYouTubeIframeAPIReady() {
      player = new YT.Player('player', {
        width: '100%',
        height: '100%',
        videoId: '${videoId}',
        playerVars: {
          autoplay: 1,
          playsinline: 1,
          start: ${startTime},
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onError: function(e) {
            // Relay error code to React Native
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ytError', code: e.data }));
          }
        }
      });
    }
  </script>
</body>
</html>`;

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ytError') {
        // 101, 150, 152 = embed not allowed; also catch 100 (deleted) and 5 (html5 error)
        const embedErrors = [5, 100, 101, 150, 152];
        if (embedErrors.includes(msg.code)) {
          setEmbedFailed(true);
        }
      }
    } catch (_) {}
  }, []);

  if (embedFailed) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: thumbnailUri }} style={styles.thumbnail} resizeMode="cover" />
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.openButton}
            onPress={() => Linking.openURL(watchUrl)}
            activeOpacity={0.85}
          >
            <Ionicons name="logo-youtube" size={22} color="#fff" />
            <Text style={styles.openButtonText}>在 YouTube 观看</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        style={styles.webview}
        source={{ html: playerHTML, baseUrl: 'https://www.youtube.com' }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={['*']}
        scrollEnabled={false}
        mixedContentMode="always"
        onMessage={handleMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF0000',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  openButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
