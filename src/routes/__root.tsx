import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useState } from "react";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, Network } from "relay-runtime";
import type { FetchFunction } from "relay-runtime";

import { getViewer } from "#/lib/auth/viewer";
import type { Viewer } from "#/lib/auth/viewer";

import appCss from "../styles.css?url";

let cachedClientViewer: Viewer | null | undefined;

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

function createRelayEnvironment() {
	return new Environment({
		network: Network.create(fetchGraphQL),
	});
}

export const Route = createRootRoute({
	beforeLoad: async () => {
		if (typeof document !== "undefined" && cachedClientViewer !== undefined) {
			return { viewer: cachedClientViewer };
		}

		const viewer = await getViewer();
		if (typeof document !== "undefined") {
			cachedClientViewer = viewer;
		}

		return { viewer };
	},
	errorComponent: RootErrorComponent,
	notFoundComponent: NotFoundComponent,
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
	const { viewer } = Route.useRouteContext();
	const [environment] = useState(createRelayEnvironment);
	if (typeof document !== "undefined") {
		cachedClientViewer = viewer;
	}

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

function RootErrorComponent({
	error,
	reset,
}: {
	error: Error;
	reset: () => void;
}) {
	return (
		<main className="flex min-h-screen items-center justify-center px-6">
			<div className="max-w-lg text-center">
				<h1 className="text-2xl font-semibold">Something went wrong</h1>
				<p className="mt-2 text-sm text-base-content/60">
					{error.message || "An unexpected error occurred."}
				</p>
				<div className="mt-6 flex justify-center gap-3">
					<button type="button" className="btn btn-accent" onClick={reset}>
						Try again
					</button>
					<a href="/" className="btn btn-ghost">
						Go home
					</a>
				</div>
			</div>
		</main>
	);
}

function NotFoundComponent() {
	return (
		<main className="flex min-h-screen items-center justify-center px-6">
			<div className="max-w-md text-center">
				<h1 className="text-2xl font-semibold">Page not found</h1>
				<p className="mt-2 text-sm text-base-content/60">
					The page you requested does not exist or is no longer available.
				</p>
				<a href="/" className="btn btn-accent mt-6">
					Go home
				</a>
			</div>
		</main>
	);
}
