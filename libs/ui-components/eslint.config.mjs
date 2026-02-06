import baseConfig from "../../eslint.config.mjs";

export default [
	...baseConfig,
	{
		ignores: [".expo", "web-build", "cache", "dist"],
	},
];
