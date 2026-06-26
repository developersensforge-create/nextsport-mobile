/**
 * Expo config plugin: withNetworkSecurityConfig
 *
 * Injects an Android network_security_config.xml and references it from
 * AndroidManifest.xml. This is required because expo prebuild regenerates
 * android/ on every CI run, so direct file edits are lost.
 *
 * Why needed:
 *   The YouTube HTML-inject WebView (source={{ html, baseUrl: 'https://www.youtube.com' }})
 *   causes Android's network security policy to inspect all traffic more strictly in
 *   release builds. Without an explicit networkSecurityConfig, the policy blocks requests
 *   — including Supabase HTTPS auth — showing "Network request failed" on login.
 *
 *   All domains here use HTTPS only. cleartext is not permitted.
 */

const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const NETWORK_SECURITY_CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <!-- Default: HTTPS only, system CAs -->
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>

  <!-- Supabase auth and storage -->
  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="true">supabase.co</domain>
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </domain-config>

  <!-- YouTube WebView embed (HTML-inject baseUrl pattern) -->
  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="true">youtube.com</domain>
    <domain includeSubdomains="true">youtu.be</domain>
    <domain includeSubdomains="true">googlevideo.com</domain>
    <domain includeSubdomains="true">ytimg.com</domain>
    <domain includeSubdomains="true">ggpht.com</domain>
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </domain-config>
</network-security-config>`;

/**
 * Step 1: Write the XML file into android/app/src/main/res/xml/
 */
const withNetworkSecurityConfigFile = (config) => {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const xmlDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, 'network_security_config.xml'),
        NETWORK_SECURITY_CONFIG_XML,
        'utf8'
      );
      return cfg;
    },
  ]);
};

/**
 * Step 2: Add android:networkSecurityConfig to <application> in AndroidManifest.xml
 */
const withNetworkSecurityConfigManifest = (config) => {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = manifest.manifest.application?.[0];
    if (app) {
      app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    }
    return cfg;
  });
};

/**
 * Combined plugin export
 */
const withNetworkSecurityConfig = (config) => {
  config = withNetworkSecurityConfigFile(config);
  config = withNetworkSecurityConfigManifest(config);
  return config;
};

module.exports = withNetworkSecurityConfig;
