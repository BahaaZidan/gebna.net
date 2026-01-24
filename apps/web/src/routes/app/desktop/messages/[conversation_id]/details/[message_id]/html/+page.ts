import { graphql } from "$houdini";

import type { MessageHTMLBodyQueryVariables } from "./$houdini";

export const _houdini_load = graphql(`
	query MessageHTMLBodyQuery($id: ID!) {
		node(id: $id) {
			... on Message {
				id
				bodyHTML
			}
		}
	}
`);

export const _MessageHTMLBodyQueryVariables: MessageHTMLBodyQueryVariables = async ({ params }) => {
	return {
		id: params.message_id,
	};
};
