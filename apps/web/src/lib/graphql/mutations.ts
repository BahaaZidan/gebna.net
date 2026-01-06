import { graphql } from "$houdini";

export const AssignTargetMailboxMutation = graphql(`
	mutation AssignTargetMailboxMutation($input: AssignTargetMailboxInput!) {
		assignTargetMailbox(input: $input) {
			id
			name
			avatar
			address
			targetMailbox {
				id
			}
		}
	}
`);
