const SITE_NAME = "gebna";

type BuildMetaInput = {
	title: string;
	description: string;
	robots?: string;
};

export function buildPageMeta({
	title,
	description,
	robots = "index, follow",
}: BuildMetaInput) {
	const fullTitle = `${title} | ${SITE_NAME}`;

	return [
		{ title: fullTitle },
		{ name: "description", content: description },
		{ name: "robots", content: robots },
		{ property: "og:site_name", content: SITE_NAME },
		{ property: "og:title", content: fullTitle },
		{ property: "og:description", content: description },
		{ name: "twitter:card", content: "summary" },
		{ name: "twitter:title", content: fullTitle },
		{ name: "twitter:description", content: description },
	];
}
