import { graphql, graphqlRequest } from "@gebna/graphql-client";

import { getRequestEvent, query } from "$app/server";

export const getEmailConvoList = query(async () => {
	const { fetch } = getRequestEvent();
	const query = graphql(`
		query ViewerEmailConversationsListQuery {
			viewer {
				id
				emailConversations {
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
