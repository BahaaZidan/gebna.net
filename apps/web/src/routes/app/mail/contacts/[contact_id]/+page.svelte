<script lang="ts">
	import BellOffIcon from "@lucide/svelte/icons/bell-off";
	import FileIcon from "@lucide/svelte/icons/file";
	import StarIcon from "@lucide/svelte/icons/star";
	import TagIcon from "@lucide/svelte/icons/tag";
	import { getContextClient, queryStore } from "@urql/svelte";

	import { page } from "$app/state";

	import Container from "$lib/components/Container.svelte";
	import ThreadListItem from "$lib/components/mail/ThreadListItem.svelte";
	import Navbar from "$lib/components/Navbar.svelte";
	import { graphql } from "$lib/graphql/generated";

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
								fileName
								mimeType
								url
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
	const contactDetailsPageQuery = queryStore({
		client: getContextClient(),
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
		<div class="flex w-full justify-end">
			<button class="btn btn-outline btn-primary">Edit Contact</button>
		</div>
		<div class="avatar">
			<div class="w-24 rounded-full">
				<img src={contact.avatar} alt="{contact.name} avatar" />
			</div>
		</div>
		<h1 class="text-xl font-semibold">{contact.name}</h1>
		<h3>{contact.address}</h3>
		<div class="flex w-full justify-center gap-3 rounded-3xl bg-base-100 p-2">
			<button class="btn btn-ghost"><BellOffIcon /> Not notifying</button>
			<button class="btn btn-ghost"><StarIcon /> Delivering to {contact.targetMailbox.name}</button>
			<button class="btn btn-ghost"><TagIcon /> Autofile in...</button>
		</div>
		{#if contact.attachments.edges.length}
			<div class="divider divider-start">
				Recent Files from <span class="font-semibold">{contact.name}</span>
			</div>
			<div class="flex w-full flex-col gap-2">
				{#each contact.attachments.edges as { node } (node.id)}
					<a href={node.url} class="badge badge-neutral">
						<FileIcon class="size-5" />
						<span class="line-clamp-1">{node.fileName}</span>
					</a>
				{/each}
			</div>
		{/if}
		<div class="divider divider-start">
			Threads with <span class="font-semibold">{contact.name}</span>
		</div>
		{#each contact.threads.edges as { node } (node.id)}
			<ThreadListItem thread={node} />
		{/each}
	{/if}
</Container>
