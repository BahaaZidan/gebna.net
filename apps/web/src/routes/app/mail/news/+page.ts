import { graphql } from "$houdini";

export const _houdini_load = graphql(`
	query NewsPageQuery {
		viewer {
			...NavbarFragment
			id
			newsMailbox: mailbox(type: news) {
				id
				type
				name
				threads(first: 5) @paginate(name: "News_Mailbox_Threads") {
					pageInfo {
						hasNextPage
						endCursor
					}
					edges {
						cursor
						node {
							id
							title
							messages {
								...MessageBody
								id
								from {
									id
									name
									avatar
									address
								}
								recievedAt
								bodyHTML
								bodyText
								to
							}
						}
					}
				}
			}
		}
	}
`);
