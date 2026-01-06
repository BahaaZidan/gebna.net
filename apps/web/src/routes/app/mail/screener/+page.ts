import { graphql } from "$houdini";

export const _houdini_load = graphql(`
	query ScreenerPageQuery {
		viewer {
			...NavbarFragment
			id
			screenerMailbox: mailbox(type: screener) {
				id
				type
				name
				assignedContactsCount
				contacts {
					edges {
						node {
							id
							address
							name
							avatar
							firstMessage {
								...MessageBody
								id
								bodyText
								bodyHTML
								subject
							}
						}
					}
				}
			}
		}
	}
`);
