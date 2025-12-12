<script lang="ts">
	import PlusIcon from "@lucide/svelte/icons/plus";
	import ThumbsDownIcon from "@lucide/svelte/icons/thumbs-down";
	import ThumbsUpIcon from "@lucide/svelte/icons/thumbs-up";
	import { getContextClient, queryStore } from "@urql/svelte";

	import { resolve } from "$app/paths";

	import Container from "$lib/components/Container.svelte";
	import Navbar from "$lib/components/Navbar.svelte";
	import { graphql } from "$lib/graphql/generated";

	const ImportantPageQuery = graphql(`
		query ImportantPageQuery {
			viewer {
				id
				username
				screenerMailbox: mailbox(type: screener) {
					id
					type
					name
					unreadThreadsCount
				}
				importantMailbox: mailbox(type: important) {
					id
					type
					name
					unreadThreadsCount
					unreadThreads: threads(filter: { unread: true }) {
						...ImportantThreadDetails
					}
					readThreads: threads(filter: { unread: false }) {
						...ImportantThreadDetails
					}
				}
			}
		}

		fragment ImportantThreadDetails on ThreadsConnection {
			pageInfo {
				hasNextPage
				endCursor
			}
			edges {
				cursor
				node {
					id
					from {
						id
						address
					}
					title
					lastMessageAt
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
			<a href={resolve("/app/mail/screener")} class="btn btn-accent">
				<div class="flex">
					<ThumbsUpIcon class="size-5" />
					<ThumbsDownIcon class="size-5" />
				</div>
				Screen {viewer.screenerMailbox?.unreadThreadsCount} thread(s) from first-time senders
			</a>

			<button class="btn btn-primary">
				<PlusIcon />
				Write
			</button>
		</div>
		<h1 class="text-5xl font-bold">Important</h1>
		<div class="divider divider-start">New for you</div>
		{#each viewer.importantMailbox?.unreadThreads.edges as { node } (node.id)}
			<div class="flex w-full">
				<div class="avatar">
					<div class="w-16 rounded-full">
						<img src="https://img.daisyui.com/images/profile/demo/gordon@192.webp" />
					</div>
				</div>
				<div class="flex flex-col gap-1">
					<div>{node.title}</div>
					<div>{node.title}</div>
				</div>
				<div>{node.lastMessageAt}</div>
			</div>
		{/each}
		<div class="divider divider-start">Previously seen</div>
		{#each viewer.importantMailbox?.readThreads.edges as { node } (node.id)}{/each}
	{/if}
</Container>
