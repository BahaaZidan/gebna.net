import { type ExecutionResult } from "graphql";

import { TypedDocumentString } from "./generated/graphql.js";

export * from "./generated/index.js";

export async function graphqlRequest<TResult, TVariables>(
	fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
	query: TypedDocumentString<TResult, TVariables>,
	...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
) {
	const response = await fetch("/api/graphql", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/graphql-response+json",
		},
		body: JSON.stringify({
			query,
			variables,
		}),
	});

	if (!response.ok) {
		throw new Error("Network response was not ok");
	}

	return response.json() as ExecutionResult<TResult>;
}
