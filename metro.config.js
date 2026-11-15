const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Web preview only: replace expo-sqlite with an in-memory sql.js shim (see dev/expo-sqlite-web-shim.js).
const shim = path.resolve(__dirname, 'dev/expo-sqlite-web-shim.js');
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'expo-sqlite') return { type: 'sourceFile', filePath: shim };
  return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
