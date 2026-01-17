import { graphql } from "$houdini";

export const _houdini_load = graphql(`
	query ConversationsListQuery {
		viewer {
			id
			conversations(first: 10, mailbox: IMPORTANT) {
				edges {
					node {
						id
						kind
						title
						updatedAt
						participants {
							identity {
								id
								address
								kind
							}
						}
					}
				}
			}
		}
	}
`);
