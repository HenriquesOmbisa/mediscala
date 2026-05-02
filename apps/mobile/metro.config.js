const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// The monorepoRoot is needed so Metro can serve files from node_modules/.bun/
// (Bun stores real package files there; node_modules/ entries are symlinks to it).
// The inotify limit has been raised to 524288 via /etc/sysctl.conf to handle
// the large number of directories this entails.
config.watchFolders = [monorepoRoot];

// Resolve modules: project-local node_modules first, then root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Resolve @mediscala/shared from source (skip the build step)
config.resolver.extraNodeModules = {
  "@mediscala/shared": path.resolve(monorepoRoot, "packages/shared/src"),
};

module.exports = withNativeWind(config, { input: "./global.css" });
