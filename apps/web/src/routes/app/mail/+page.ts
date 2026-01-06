import { graphql, load_ImportantPageQuery, load_ImportantSeenThreadsQuery } from "$houdini";

import type { PageLoad } from "./$houdini";

graphql(`
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
				unseenThreads: threads(first: 20, filter: { unseen: true })
					@paginate(name: "Important_Mailbox_Unseen_Threads") {
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

graphql(`
	query ImportantSeenThreadsQuery {
		viewer {
			importantMailbox: mailbox(type: important) {
				id
				seenThreads: threads(first: 20, filter: { unseen: false })
					@paginate(name: "Important_Mailbox_Seen_Threads") {
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

export const load: PageLoad = async (event) => {
	const tata = await Promise.all([
		load_ImportantPageQuery({ event }),
		load_ImportantSeenThreadsQuery({ event }),
	]);
	const response = Object.assign({}, ...tata);
	return response;
};
