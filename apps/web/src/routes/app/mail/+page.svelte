<script lang="ts">
	import PlusIcon from "@lucide/svelte/icons/plus";
	import ThumbsDownIcon from "@lucide/svelte/icons/thumbs-down";
	import ThumbsUpIcon from "@lucide/svelte/icons/thumbs-up";
	import { getContextClient, queryStore } from "@urql/svelte";

	import { resolve } from "$app/paths";

	import Container from "$lib/components/Container.svelte";
	import Navbar from "$lib/components/Navbar.svelte";
	import { graphql } from "$lib/graphql/generated";

	const ViewerQuery = graphql(`
		query Viewer {
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
					threads {
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
				}
			}
		}
	`);

	const viewerQuery = queryStore({
		client: getContextClient(),
		query: ViewerQuery,
	});
</script>

<Navbar />
<Container>
	{#if $viewerQuery.fetching}
		<p>Loading...</p>
	{:else if $viewerQuery.error}
		<p>Oh no... {$viewerQuery.error.message}</p>
	{:else if $viewerQuery.data?.viewer?.username}
		{@const viewer = $viewerQuery.data.viewer}

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
