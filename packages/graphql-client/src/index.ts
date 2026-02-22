import { type ExecutionResult } from "graphql";

import { TypedDocumentString } from "./generated/graphql.js";

export * from "./generated/index.js";
export * from "./generated/graphql.js";

type GraphQLRequestArgs<TResult, TVariables> = {
	fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
	query: TypedDocumentString<TResult, TVariables>;
} & (TVariables extends Record<string, never>
	? { variables?: undefined }
	: { variables: TVariables });

export async function graphqlRequest<TResult, TVariables>({
	fetch,
	query,
	variables,
}: GraphQLRequestArgs<TResult, TVariables>) {
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
