const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// --- Monorepo (npm workspaces) support -------------------------------------
// This app lives at apps/mobile/ with dependencies hoisted to the monorepo
// root. Watch the whole repo so Metro picks up changes in shared packages,
// and resolve modules from both the app's own node_modules and the hoisted
// root node_modules. See https://docs.expo.dev/guides/monorepos/
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Web bundle breaks if react-native-maps is followed (native-only).
// Expo Router's route-graph generation can pull in `.native.tsx` files even
// for the web bundle, so alias react-native-maps to a stub when bundling web.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // @supabase/supabase-js (>=2.49) dynamically imports the OPTIONAL
  // @opentelemetry/api for tracing. It isn't a real dependency and Metro
  // can't follow the dynamic import, so resolve it to an empty module.
  // supabase-js guards against a missing/empty OTEL module (it checks
  // otel.propagation / otel.context), so tracing is simply disabled — the
  // intended default — with no runtime impact.
  if (moduleName === '@opentelemetry/api') {
    return { type: 'empty' };
  }
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return {
      filePath: path.resolve(projectRoot, 'lib/stubs/react-native-maps.web.js'),
      type: 'sourceFile',
    };
  }
  return originalResolveRequest
    ? originalResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
