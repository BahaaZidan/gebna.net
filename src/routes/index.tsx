import { createFileRoute } from "@tanstack/react-router";

import { buildPageMeta } from "#/lib/utils/seo";

export const Route = createFileRoute("/")({
	component: App,
	head: () => ({
		meta: buildPageMeta({
			title: "gebna",
			description: "gebna",
		}),
	}),
});

function App() {
	return (
		<main className="page-wrap px-4 pb-8 pt-14">this is the landing page</main>
	);
}
