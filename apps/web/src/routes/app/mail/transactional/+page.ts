import { graphql } from "$houdini";

export const _houdini_load = graphql(`
	query TransactionalPageQuery {
		viewer {
			...NavbarFragment
			id
			transactionalMailbox: mailbox(type: transactional) {
				id
				type
				name
				threads {
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
