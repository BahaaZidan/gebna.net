//  @ts-check

/** @type {import('prettier').Config} */
const config = {
	useTabs: true,
	semi: true,
	singleQuote: false,
	trailingComma: "all",
	plugins: [
		"prettier-plugin-tailwindcss",
		"@ianvs/prettier-plugin-sort-imports",
	],
	importOrder: [
		"^@",
		"<THIRD_PARTY_MODULES>",
		"",
		"^\\$(?!lib/)",
		"",
		"^\\#/lib/",
		"",
		"^[.]",
	],
};

export default config;
