import { graphql } from "$houdini";

export const _houdini_load = graphql(`
	query TrashPageQuery {
		viewer {
			...NavbarFragment
			id
			trashMailbox: mailbox(type: trash) {
				id
				type
				name
				threads(first: 20) @paginate(name: "Trash_Mailbox_Threads") {
					pageInfo {
						hasNextPage
						endCursor
					}
					edges {
						cursor
						node {
							id
							...ThreadListItem
						}
					}
				}
			}
		}
	}
`);
