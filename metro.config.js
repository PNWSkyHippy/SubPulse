const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase JS SDK's auth module ships as CommonJS (.cjs) in a way that
// conflicts with Metro's newer package-exports resolution (on by default
// since Expo SDK 53). Without this, Metro resolves firebase/auth to a build
// that never registers its auth component, causing a "Component auth has
// not been registered yet" crash on every load — not a code bug, a known
// Metro/Firebase incompatibility. See: https://github.com/expo/expo/issues/36588
config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

// The gateway (server/) has its own node_modules; keep Metro from crawling it.
// Anchored to this project's server/ folder only (node_modules packages with a "server" dir stay visible).
const serverDir = require('path').resolve(__dirname, 'server').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = [new RegExp(`^${serverDir}[\\\\/].*`)];

module.exports = config;
