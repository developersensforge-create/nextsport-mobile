import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface YouTubePlayerProps {
  /** 11-char YouTube video ID (not the full URL) */
  videoId: string;
  /** Optional start time in seconds */
  startTime?: number;
}

/**
 * Inline YouTube player using HTML injection.
 *
 * Why html-inject instead of uri?
 * - Android WebView blocks youtube.com/embed via uri due to User-Agent detection (Error 153)
 * - Injecting raw HTML with an <iframe> inside a local document sidesteps the UA check
 * - baseUrl="https://www.youtube.com" makes the iframe treat itself as same-origin,
 *   which satisfies YouTube's referrer/origin policy without triggering embed blocks
 */
export default function YouTubePlayer({ videoId, startTime = 0 }: YouTubePlayerProps) {
  const embedSrc =
    `https://www.youtube.com/embed/${videoId}` +
    `?autoplay=1&playsinline=1&enablejsapi=1&start=${startTime}&rel=0&modestbranding=1`;

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
  <iframe
    src="${embedSrc}"
    allow="autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
    allowfullscreen
    referrerpolicy="strict-origin-when-cross-origin">
  </iframe>
</body>
</html>`;

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
});
