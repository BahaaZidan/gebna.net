import { graphql } from "$houdini";

export const _houdini_load = graphql(`
	query AllFilesPageQuery(
		$firstAttachments: Int = 10
		$afterAttachment: String
		$filterAttachments: AttachmentsFilter = {}
		$firstContacts: Int = 10
		$afterContact: String
	) {
		viewer {
			...NavbarFragment
			id
			attachments(first: $firstAttachments, after: $afterAttachment, filter: $filterAttachments) {
				pageInfo {
					endCursor
					hasNextPage
				}
				edges {
					cursor
					node {
						...AttachmentListItem
						id
					}
				}
			}
			contacts(first: $firstContacts, after: $afterContact) {
				pageInfo {
					endCursor
					hasNextPage
				}
				edges {
					cursor
					node {
						id
						name
						address
						avatar
					}
				}
			}
		}
	}
`);
