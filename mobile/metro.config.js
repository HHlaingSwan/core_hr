const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes("lottie")) {
  config.resolver.assetExts.push("lottie");
}

module.exports = withNativeWind(config, { input: "./src/global.css" });
