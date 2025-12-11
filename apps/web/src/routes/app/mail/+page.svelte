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
					from
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
			<a href={resolve("/app/mail/screener")} class="btn rounded-3xl btn-accent">
				<div class="flex">
					<ThumbsUpIcon class="size-5" />
					<ThumbsDownIcon class="size-5" />
				</div>
				Screen {viewer.screenerMailbox?.unreadThreadsCount} thread(s) from first-time senders
			</a>

			<button class="btn rounded-3xl btn-primary">
				<PlusIcon />
				Write
			</button>
		</div>
		<h1>Important</h1>
	{/if}
</Container>
