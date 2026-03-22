import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, Network, type FetchFunction } from "relay-runtime";

import { getViewer } from "#/lib/auth/viewer";

import appCss from "../styles.css?url";

const fetchGraphQL: FetchFunction = async (request, variables) => {
	const resp = await fetch("/api/graphql", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ query: request.text, variables }),
	});
	if (!resp.ok) {
		throw new Error("Response failed.");
	}
	return await resp.json();
};

const environment = new Environment({
	network: Network.create(fetchGraphQL),
});

export const Route = createRootRoute({
	beforeLoad: async () => {
		const viewer = await getViewer();

		return { viewer };
	},
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "TanStack Start Starter",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script />
				<HeadContent />
			</head>
			<body className="font-sans antialiased wrap-anywhere">
				<RelayEnvironmentProvider environment={environment}>
					{children}
				</RelayEnvironmentProvider>
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
