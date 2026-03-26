import { createFileRoute } from "@tanstack/react-router";

import { buildPageMeta } from "#/lib/utils/seo";

export const Route = createFileRoute("/_app/app/")({
	component: RouteComponent,
	head: () => ({
		meta: buildPageMeta({
			title: "Search",
			description: "gebna search.",
			robots: "noindex, nofollow",
		}),
	}),
});

function RouteComponent() {
	return null;
}
