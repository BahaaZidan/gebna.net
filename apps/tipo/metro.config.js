const { getDefaultConfig } = require("@expo/metro-config");
const { mergeConfig } = require("metro-config");
const { withUniwindConfig } = require("uniwind/metro");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..", "..");
const routerRoot = path.relative(workspaceRoot, path.join(__dirname, "src", "app"));

const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;
const previousRewriteRequestUrl = defaultConfig.server?.rewriteRequestUrl;

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const baseConfig = {
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
	watchFolders: [workspaceRoot],
	resolver: {
		...defaultConfig.resolver,
		nodeModulesPaths: [
			path.join(__dirname, "node_modules"),
			path.join(workspaceRoot, "node_modules"),
		],
		assetExts: assetExts.filter((ext) => ext !== "svg"),
		sourceExts: [...sourceExts, "cjs", "mjs", "svg"],
	},
};

const mergedConfig = mergeConfig(defaultConfig, baseConfig);

module.exports = withUniwindConfig(mergedConfig, {
	cssEntryFile: "global.css",
});
