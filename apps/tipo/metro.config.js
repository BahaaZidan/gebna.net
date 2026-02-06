const { withNxMetro } = require("@nx/expo");
const { getDefaultConfig } = require("@expo/metro-config");
const { mergeConfig } = require("metro-config");
const { withUniwindConfig } = require("uniwind/metro");
const path = require("path");

const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;

const workspaceRoot = path.resolve(__dirname, "..", "..");
const routerRoot = path.relative(workspaceRoot, path.join(__dirname, "src", "app"));
const previousRewriteRequestUrl = defaultConfig.server?.rewriteRequestUrl;

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const customConfig = {
	cacheVersion: "@gebna/tipo",
	server: {
		rewriteRequestUrl: (url) => {
			const rewrittenUrl = typeof previousRewriteRequestUrl === "function" ? previousRewriteRequestUrl(url) : url;

			try {
				const ensured = rewrittenUrl.startsWith("/")
					? new URL(rewrittenUrl, "https://metro.invalid")
					: new URL(rewrittenUrl);

				if (!ensured.searchParams.has("transform.routerRoot")) {
					ensured.searchParams.set("transform.routerRoot", routerRoot);
				}

				return rewrittenUrl.startsWith("/")
					? `${ensured.pathname}?${ensured.searchParams.toString()}`
					: ensured.toString();
			} catch {
				return rewrittenUrl;
			}
		},
	},
	transformer: {
		babelTransformerPath: require.resolve("react-native-svg-transformer"),
		unstable_allowRequireContext: true,
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
