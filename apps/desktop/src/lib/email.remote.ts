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

export const getEmailThreadDetails = query(v.optional(v.string()), async (id) => {
	if (!id) return;
	const { fetch } = getRequestEvent();
	const query = graphql(`
		query EmailThreadDetails($id: ID!) {
			node(id: $id) {
				__typename
				... on EmailThread {
					...EmailThreadTitle
					...EmailThreadAvatar
					id
					messages {
						edges {
							node {
								...EmailMessageBubble
								id
							}
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
		},
	});

	return result;
});
