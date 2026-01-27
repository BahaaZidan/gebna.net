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
				messages(last: 30) @paginate(name: "Conversation_Messages") {
					edges {
						node {
							id
							...MessageBubble
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
