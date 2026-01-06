import { cache, graphql, type MailboxType$options } from "$houdini";

export const AssignTargetMailboxMutation = graphql(`
	mutation AssignTargetMailboxMutation($input: AssignTargetMailboxInput!) {
		assignTargetMailbox(input: $input) {
			...Screener_Mailbox_Contacts_remove
			id
			name
			avatar
			address
			targetMailbox {
				id
				name
				type
			}
		}
	}
`);

export const assignTargetMailbox = async ({
	contactID,
	targetMailboxType,
}: {
	contactID: string;
	targetMailboxType: MailboxType$options;
}) => {
	await AssignTargetMailboxMutation.mutate({
		input: {
			contactID,
			targetMailboxType,
		},
	});
	cache.markStale("User", {
		when: {
			// TODO: this seems to invalidate all user instances not just the specific type. It works UX-wise. So we'll keep it for now.
			type: targetMailboxType,
		},
	});
};
