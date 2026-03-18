import { graphql, graphqlRequest } from "@gebna/graphql-client";
import { v } from "@gebna/vali";

import { getRequestEvent, query } from "$app/server";

export const getEmailThreadsConnection = query(
	v.object({
		first: v.pipe(v.number(), v.integer(), v.minValue(5), v.maxValue(30)),
		after: v.optional(v.pipe(v.string(), v.trim(), v.base64())),
	}),
	async ({ first, after }) => {
		const { fetch } = getRequestEvent();
		const query = graphql(`
			query ViewerEmailThreadsListQuery($first: Int!, $after: String) {
				viewer {
					id
					emailThreads(first: $first, after: $after) {
						edges {
							cursor
							node {
								...EmailThreadTitle
								...EmailThreadAvatar
								id
								title
								unseenCount
								lastMessage {
									id
									snippet
									createdAt
									from {
										id
										name
										address
									}
								}
							}
						}
						pageInfo {
							hasNextPage
							endCursor
						}
					}
				}
			}
		`);
		const result = await graphqlRequest({
			query,
			fetch,
			variables: {
				first,
				after,
			},
		});

		return result;
	}
);

export const getEmailThreadDetails = query(
	v.optional(
		v.object({
			id: v.optional(v.pipe(v.string(), v.base64())),
			messagesPagination: v.object({
				first: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(30)),
				after: v.optional(v.pipe(v.string(), v.trim(), v.base64())),
			}),
		})
	),
	async (args) => {
		if (!args || !args.id) return;
		const {
			id,
			messagesPagination: { first, after },
		} = args;
		const { fetch } = getRequestEvent();
		const query = graphql(`
			query EmailThreadDetails($id: ID!, $first: Int!, $after: String) {
				node(id: $id) {
					__typename
					... on EmailThread {
						...EmailThreadTitle
						...EmailThreadAvatar
						id
						unseenCount
						messages(first: $first, after: $after) {
							edges {
								node {
									...EmailMessageBubble
									id
								}
							}
							pageInfo {
								hasNextPage
								endCursor
							}
						}
					}
				}
			}
		`);
		const result = await graphqlRequest({
			query,
			fetch,
			variables: {
				id,
				first,
				after,
			},
		});

		return result;
	}
);
