import { graphql } from "$houdini";

import type { ConversationDetailsQueryVariables } from "./$houdini";

export const _houdini_load = graphql(`
	query ConversationDetailsQuery($id: ID!) {
		node(id: $id) {
			... on Conversation {
				...ConversationTitle
				...ConversationAvatar
				id
				kind
				lastMessage {
					id
				}
				messages(last: 30) {
					edges {
						node {
							id
							bodyText
							bodyHTML
							bodyMD
							bodyTextWithLinks
							createdAt
							sender {
								id
								address
								kind
								avatar
								name
							}
						}
					}
				}
				viewerState {
					mailbox
					unreadCount
				}
			}
		}
	}
`);

export const _ConversationDetailsQueryVariables: ConversationDetailsQueryVariables = async ({
	params,
}) => {
	return {
		id: params.conversation_id,
	};
};
