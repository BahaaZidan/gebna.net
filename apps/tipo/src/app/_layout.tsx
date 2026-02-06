/* eslint-disable jsx-a11y/accessible-emoji */
import { Suspense } from "react";

import "../../global.css";

import { Slot } from "expo-router";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, FetchFunction, Network } from "relay-runtime";

const HTTP_ENDPOINT = "http://localhost:5173/graphql";

const fetchGraphQL: FetchFunction = async (request, variables) => {
	const resp = await fetch(HTTP_ENDPOINT, {
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

export const RootLayout = () => {
	return (
		<RelayEnvironmentProvider environment={environment}>
			<Suspense fallback="Loading...">
				<Slot />
			</Suspense>
		</RelayEnvironmentProvider>
	);
};

export default RootLayout;
