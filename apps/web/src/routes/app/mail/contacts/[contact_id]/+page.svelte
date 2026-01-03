<script lang="ts">
	import BellOffIcon from "@lucide/svelte/icons/bell-off";
	import FileIcon from "@lucide/svelte/icons/file";
	import TagIcon from "@lucide/svelte/icons/tag";
	import { getContextClient, queryStore } from "@urql/svelte";

	import { page } from "$app/state";

	import Container from "$lib/components/Container.svelte";
	import AttachmentListItem from "$lib/components/mail/AttachmentListItem.svelte";
	import ThreadListItem from "$lib/components/mail/ThreadListItem.svelte";
	import Navbar from "$lib/components/Navbar.svelte";
	import { graphql } from "$lib/graphql/generated";
	import { assignTargetMailbox } from "$lib/graphql/mutations";
	import { TARGET_MAILBOXES } from "$lib/mail";

	const ContactDetailsPageQuery = graphql(`
		query ContactDetailsPageQuery($id: ID!, $attachmentsAfter: String, $threadsAfter: String) {
			viewer {
				...NavbarFragment
			}
			node(id: $id) {
				__typename
				... on Contact {
					id
					name
					address
					avatar
					targetMailbox {
						id
						name
						type
					}
					attachments(first: 10, after: $attachmentsAfter) {
						pageInfo {
							endCursor
							hasNextPage
						}
						edges {
							cursor
							node {
								id
								...AttachmentListItem
							}
						}
					}
					threads(first: 10, after: $threadsAfter) {
						pageInfo {
							endCursor
							hasNextPage
						}
						edges {
							cursor
							node {
								...ThreadListItem
								id
							}
						}
					}
				}
			}
		}
	`);
	const urqlClient = getContextClient();
	const contactDetailsPageQuery = queryStore({
		client: urqlClient,
		query: ContactDetailsPageQuery,
		variables: {
			id: page.params.contact_id!,
		},
	});
	const contact = $derived(
		$contactDetailsPageQuery.data?.node?.__typename === "Contact"
			? $contactDetailsPageQuery.data?.node
			: null
	);
</script>

<Navbar viewer={$contactDetailsPageQuery.data?.viewer} />
<Container>
	{#if contact}
		{@const TargetMailboxIcon =
			TARGET_MAILBOXES[TARGET_MAILBOXES.findIndex((mb) => mb.type === contact.targetMailbox.type)]
				.icon}
		<div class="flex w-full justify-end">
			<button class="btn btn-outline btn-primary">Edit Contact</button>
		</div>
		<div class="avatar">
			<div class="w-20 rounded-full">
				<img src={contact.avatar} alt="{contact.name} avatar" />
			</div>
		</div>
		<h1 class="text-3xl font-semibold">{contact.name}</h1>
		<h3>{contact.address}</h3>
		<div class="flex w-full justify-center gap-3 rounded-3xl bg-base-100 p-2">
			<button class="btn btn-ghost"><BellOffIcon /> Not notifying</button>
			<button
				class="btn btn-ghost"
				popovertarget="popover-target-mailboxes"
				style="anchor-name:--anchor-target-mailboxes"
			>
				<TargetMailboxIcon /> Delivering to {contact.targetMailbox.name}
			</button>
			<ul
				class="menu dropdown w-52 rounded-box bg-base-100 shadow-sm"
				popover
				id="popover-target-mailboxes"
				style="position-anchor:--anchor-target-mailboxes"
			>
				{#each TARGET_MAILBOXES.filter((b) => b.type !== contact.targetMailbox.type) as targetMailbox (targetMailbox.name)}
					<li>
						<button onclick={assignTargetMailbox(urqlClient, contact.id, targetMailbox.type)}>
							<targetMailbox.icon />
							{targetMailbox.name}
						</button>
					</li>
				{/each}
			</ul>
			<button class="btn btn-ghost"><TagIcon /> Autofile in...</button>
		</div>
		{#if contact.attachments.edges.length}
			<div class="divider divider-start">Files</div>
			<div class="flex w-full flex-wrap justify-center gap-2">
				{#each contact.attachments.edges as { node } (node.id)}
					<AttachmentListItem attachment={node} />
				{/each}
			</div>
		{/if}
		<div class="divider divider-start">Threads</div>
		{#each contact.threads.edges as { node } (node.id)}
			<ThreadListItem thread={node} />
		{/each}
	{/if}
</Container>
