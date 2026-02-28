import { graphql, graphqlRequest } from "@gebna/graphql-client";
import { v } from "@gebna/vali";

import { getRequestEvent, query } from "$app/server";

export const getEmailConvoList = query(async () => {
	const { fetch } = getRequestEvent();
	const query = graphql(`
		query ViewerEmailConversationsListQuery {
			viewer {
				id
				emailConversations(first: 30) {
					edges {
						node {
							...EmailConversationTitle
							...EmailConversationAvatar
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

export const getEmailConvoDetails = query(v.optional(v.string()), async (id) => {
	if (!id) return;
	const { fetch } = getRequestEvent();
	const query = graphql(`
		query EmailConversationDetails($id: ID!) {
			node(id: $id) {
				__typename
				... on EmailConversation {
					...EmailConversationTitle
					...EmailConversationAvatar
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
