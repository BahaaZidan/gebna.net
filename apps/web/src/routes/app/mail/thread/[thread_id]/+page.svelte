<script lang="ts">
	import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
	import { getContextClient, mutationStore, queryStore } from "@urql/svelte";

	import { resolve } from "$app/paths";
	import { page } from "$app/state";

	import Container from "$lib/components/Container.svelte";
	import Avatar from "$lib/components/mail/Avatar.svelte";
	import Navbar from "$lib/components/Navbar.svelte";
	import { formatInboxDate } from "$lib/date";
	import { graphql } from "$lib/graphql/generated";

	const ThreadDetails = graphql(`
		query ThreadDetails($id: ID!) {
			node(id: $id) {
				__typename
				... on Thread {
					id
					from {
						id
						address
						name
						avatar
					}
					unseenMessagesCount
					title
					lastMessageAt
					messages {
						id
						bodyHTML
						recievedAt
						from {
							id
							address
							name
							avatar
						}
						unseen
						snippet
						bodyText
						subject
						to
						cc
						replyTo
						attachments {
							id
							fileName
							mimeType
							contentId
							downloadURL
						}
					}
				}
			}
		}
	`);

	const urqlClient = getContextClient();
	const threadDetailsQuery = queryStore({
		client: urqlClient,
		query: ThreadDetails,
		variables: {
			id: page.params.thread_id!,
		},
	});
	const thread = $derived(
		$threadDetailsQuery.data?.node?.__typename === "Thread" ? $threadDetailsQuery.data.node : null
	);

	const MarkThreadSeenMutation = graphql(`
		mutation MarkThreadSeen($id: ID!) {
			markThreadSeen(id: $id) {
				id
				unseenMessagesCount
				messages {
					id
					unseen
				}
			}
		}
	`);

	const markThreadSeen = () => {
		mutationStore({
			client: urqlClient,
			query: MarkThreadSeenMutation,
			variables: { id: page.params.thread_id! },
		});
	};

	$effect(() => {
		if (!thread) return;
		let timeout: NodeJS.Timeout | null;
		if (thread.unseenMessagesCount > 0) {
			timeout = setTimeout(() => markThreadSeen(), 2000);
		}
		return () => {
			if (timeout) clearTimeout(timeout);
		};
	});
</script>

<Navbar>
	{#snippet prepend()}
		<a href={resolve("/app/mail")} class="btn mr-2 btn-accent">
			<ChevronLeftIcon />
			Important
		</a>
	{/snippet}
</Navbar>
<Container>
	{#if thread}
		<h1 class="mb-2 text-5xl font-bold">{thread.title}</h1>
		{#each thread.messages as message (message.id)}
			<div class="flex w-full gap-2 p-4">
				<Avatar src={message.from.avatar} alt={message.from.name} />
				<div class="flex w-full flex-col">
					<div class="flex items-center gap-1">
						<div class="font-semibold">{message.from.name}</div>
						<div class="text-sm">{message.from.address}</div>
						<div class="ml-auto">{formatInboxDate(message.recievedAt)}</div>
					</div>
					<div class="text-sm">
						to <span class="font-semibold">{message.to}</span>
					</div>
					<div class="mt-3">
						{#if message.bodyHTML}
							{@html message.bodyHTML}
						{:else}
							{message.bodyText}
						{/if}
					</div>
				</div>
			</div>
		{/each}
	{/if}
</Container>
