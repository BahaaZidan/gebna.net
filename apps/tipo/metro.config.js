const { withNxMetro } = require("@nx/expo");
const { getDefaultConfig } = require("@expo/metro-config");
const { mergeConfig } = require("metro-config");
const { withUniwindConfig } = require("uniwind/metro");

const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const customConfig = {
	cacheVersion: "@gebna/tipo",
	transformer: {
		babelTransformerPath: require.resolve("react-native-svg-transformer"),
	},
	resolver: {
		assetExts: assetExts.filter((ext) => ext !== "svg"),
		sourceExts: [...sourceExts, "cjs", "mjs", "svg"],
	},
};

module.exports = Promise.resolve(mergeConfig(defaultConfig, customConfig))
	.then((config) =>
		withNxMetro(config, {
			debug: false,
			extensions: [],
			watchFolders: [],
		})
	)
	.then((config) => {
		return withUniwindConfig(config, {
			cssEntryFile: "global.css",
		});
	});
