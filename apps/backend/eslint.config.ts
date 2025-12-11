import { readFileSync } from "fs";
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const gitignore = readFileSync(".gitignore", "utf8")
	.split("\n")
	.filter(Boolean)
	.filter((line) => !line.startsWith("#"));

export default defineConfig([
	{
		ignores: gitignore,
	},
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
		plugins: { js },
		extends: ["js/recommended"],
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
	},
	tseslint.configs.recommended,
	{
		rules: {
			"no-undef": "off",
			eqeqeq: "error",
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					args: "all",
					argsIgnorePattern: "^_",
					caughtErrors: "all",
					caughtErrorsIgnorePattern: "^_",
					destructuredArrayIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					ignoreRestSiblings: true,
				},
			],
			// 'no-console': 'error',
		},
	},
]);
