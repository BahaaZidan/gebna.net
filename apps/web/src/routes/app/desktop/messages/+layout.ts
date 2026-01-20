import { graphql } from "$houdini";

export const _houdini_load = graphql(`
	query ConversationsListQuery {
		viewer {
			id
			conversations(first: 30, mailbox: IMPORTANT) {
				edges {
					node {
						...ConversationTitle
						...ConversationAvatar
						id
						kind
						title
						updatedAt
						viewerState {
							unreadCount
						}
						lastMessage {
							id
							bodyText
						}
						participants {
							identity {
								id
								address
								kind
								name
								avatar
								relationshipToViewer {
									id
									isContact
									displayName
									avatarUrl
								}
							}
						}
					}
				}
			}
		}
	}
`);
