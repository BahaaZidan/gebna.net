import { graphql } from "$houdini";

import type { ThreadDetailsVariables } from "./$houdini";

export const _houdini_load = graphql(`
	query ThreadDetails($id: ID!) {
		viewer {
			...NavbarFragment
		}
		node(id: $id) {
			__typename
			... on Thread {
				id
				from {
					id
					address
					name
					avatar
				}
				unseenMessagesCount
				title
				lastMessageAt
				messages {
					...MessageBody
					id
					bodyHTML
					recievedAt
					from {
						id
						address
						name
						avatar
					}
					unseen
					snippet
					bodyText
					subject
					to
					cc
					replyTo
					attachments {
						id
						...AttachmentListItem
					}
				}
				mailbox {
					id
					...MailboxLink
				}
			}
		}
	}
`);

export const _ThreadDetailsVariables: ThreadDetailsVariables = (event) => {
	return {
		id: event.params.thread_id,
	};
};
