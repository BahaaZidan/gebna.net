import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: ["**/dist", "**/out-tsc", "**/web-build", "**/.expo", "**/cache", "**/.cache", "**/node_modules", "**/tmp", "**/vite.config.*.timestamp*"],
	},
	js.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	{
		files: ["**/*.{ts,tsx,js,jsx}"],
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		plugins: {
			import: importPlugin,
			"jsx-a11y": jsxA11y,
			react: reactPlugin,
			"react-hooks": reactHooks,
		},
		settings: {
			react: { version: "detect" },
		},
		rules: {
			"react/jsx-uses-react": "off",
			"react/react-in-jsx-scope": "off",
			"react-hooks/rules-of-hooks": "error",
			"react-hooks/exhaustive-deps": "warn",
			"import/order": [
				"warn",
				{
					alphabetize: { order: "asc", caseInsensitive: true },
					"newlines-between": "always",
					groups: [["builtin", "external"], "internal", ["parent", "sibling", "index", "object"]],
				},
			],
		},
	}
);
