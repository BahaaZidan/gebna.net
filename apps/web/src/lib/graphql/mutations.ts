import { Client, mutationStore } from "@urql/svelte";

import { graphql } from "./generated";
import type { MailboxType } from "./generated/graphql";

const AssignTargetMailboxMutation = graphql(`
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

export const assignTargetMailbox =
	(urqlClient: Client, contactID: string, targetMailboxType: MailboxType) => () => {
		mutationStore({
			client: urqlClient,
			query: AssignTargetMailboxMutation,
			variables: { input: { contactID, targetMailboxType } },
		});
	};
