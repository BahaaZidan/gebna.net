import { createFileRoute } from "@tanstack/react-router";

import { buildPageMeta } from "#/lib/utils/seo";

export const Route = createFileRoute("/_app/app/settings/")({
	component: RouteComponent,
	head: () => ({
		meta: buildPageMeta({
			title: "Settings",
			description: "gebna settings.",
			robots: "noindex, nofollow",
		}),
	}),
});

function RouteComponent() {
	return <div>Hello "/app/settings/"!</div>;
}
