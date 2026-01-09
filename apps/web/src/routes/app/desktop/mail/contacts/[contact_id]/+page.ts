import { graphql } from "$houdini";

import type { ContactDetailsPageQueryVariables } from "./$houdini";

export const _houdini_load = graphql(`
	query ContactDetailsPageQuery($id: ID!, $attachmentsAfter: String, $threadsAfter: String) {
		viewer {
			...NavbarFragment
		}
		node(id: $id) {
			... on Contact {
				...AssignTargetMailboxButton
				id
				name
				address
				avatar
				targetMailbox {
					id
					name
					type
				}
				attachments(first: 10, after: $attachmentsAfter) {
					pageInfo {
						endCursor
						hasNextPage
					}
					edges {
						cursor
						node {
							id
							...AttachmentListItem
						}
					}
				}
				threads(first: 10, after: $threadsAfter) {
					pageInfo {
						endCursor
						hasNextPage
					}
					edges {
						cursor
						node {
							...ThreadListItem
							id
						}
					}
				}
			}
		}
	}
`);

export const _ContactDetailsPageQueryVariables: ContactDetailsPageQueryVariables = (event) => {
	return {
		id: event.params.contact_id,
	};
};
