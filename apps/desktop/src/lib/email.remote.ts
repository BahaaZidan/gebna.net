import { graphql, graphqlRequest } from "@gebna/graphql-client";
import { v } from "@gebna/vali";

import { getRequestEvent, query } from "$app/server";

export const getEmailConvoList = query(async () => {
	const { fetch } = getRequestEvent();
	const query = graphql(`
		query ViewerEmailThreadsListQuery {
			viewer {
				id
				emailThreads(first: 30) {
					edges {
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
				}
			}
		}
	`);
	const result = await graphqlRequest({
		query,
		fetch,
	});

	return result;
});

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
