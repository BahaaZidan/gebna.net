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
				contacts(first: 20) @paginate(name: "Screener_Mailbox_Contacts") {
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
