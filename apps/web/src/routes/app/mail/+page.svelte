<script lang="ts">
	import PlusIcon from "@lucide/svelte/icons/plus";
	import ThumbsDownIcon from "@lucide/svelte/icons/thumbs-down";
	import ThumbsUpIcon from "@lucide/svelte/icons/thumbs-up";
	import { getContextClient, queryStore } from "@urql/svelte";

	import { resolve } from "$app/paths";

	import Container from "$lib/components/Container.svelte";
	import ThreadListItem from "$lib/components/mail/ThreadListItem.svelte";
	import Navbar from "$lib/components/Navbar.svelte";
	import { graphql } from "$lib/graphql/generated";

	const ImportantPageQuery = graphql(`
		query ImportantPageQuery {
			viewer {
				id
				username
				screenerMailbox: mailbox(type: screener) {
					id
					assignedContactsCount
				}
				importantMailbox: mailbox(type: important) {
					id
					type
					name
					unreadThreadsCount
					unreadThreads: threads(filter: { unread: true }) {
						pageInfo {
							hasNextPage
							endCursor
						}
						edges {
							cursor
							node {
								id
								...ThreadListItem
							}
						}
					}
					readThreads: threads(filter: { unread: false }) {
						pageInfo {
							hasNextPage
							endCursor
						}
						edges {
							cursor
							node {
								id
								...ThreadListItem
							}
						}
					}
				}
			}
		}
	`);

	const importantPageQuery = queryStore({
		client: getContextClient(),
		query: ImportantPageQuery,
	});
</script>

<Navbar />
<Container>
	{#if $importantPageQuery.fetching}
		<p>Loading...</p>
	{:else if $importantPageQuery.error}
		<p>Oh no... {$importantPageQuery.error.message}</p>
	{:else if $importantPageQuery.data?.viewer?.username}
		{@const viewer = $importantPageQuery.data.viewer}

		<div class="flex w-full justify-between">
			<a
				href={resolve("/app/mail/screener")}
				class={["btn btn-accent", { invisible: !viewer.screenerMailbox?.assignedContactsCount }]}
			>
				<div class="flex">
					<ThumbsUpIcon class="size-5" />
					<ThumbsDownIcon class="size-5" />
				</div>
				Screen {viewer.screenerMailbox?.assignedContactsCount} first-time senders
			</a>

			<button class="btn btn-primary">
				<PlusIcon />
				Write
			</button>
		</div>
		<h1 class="text-5xl font-bold">Important</h1>
		<div class="divider divider-start">New for you</div>
		<div class="flex w-full flex-col gap-2">
			{#each viewer.importantMailbox?.unreadThreads.edges as { node } (node.id)}
				<ThreadListItem thread={node} />
			{/each}
		</div>
		<div class="divider divider-start">Previously seen</div>
		{#each viewer.importantMailbox?.readThreads.edges as { node } (node.id)}
			<ThreadListItem thread={node} />
		{/each}
	{/if}
</Container>
