import { graphql } from "$houdini";

export const _houdini_load = graphql(`
	query ImportantPageQuery {
		viewer {
			...NavbarFragment
			id
			username
			screenerMailbox: mailbox(type: screener) {
				id
				assignedContactsCount
			}
			importantMailbox: mailbox(type: important) {
				id
				type
				name
				unseenThreadsCount
				unseenThreads: threads(filter: { unseen: true }) {
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
				seenThreads: threads(filter: { unseen: false }) {
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
