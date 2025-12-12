<script lang="ts">
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
	import KeyIcon from "@lucide/svelte/icons/key";
	import ThumbsDownIcon from "@lucide/svelte/icons/thumbs-down";
	import ThumbsUpIcon from "@lucide/svelte/icons/thumbs-up";
	import { getContextClient, queryStore } from "@urql/svelte";

	import { resolve } from "$app/paths";

	import Container from "$lib/components/Container.svelte";
	import Navbar from "$lib/components/Navbar.svelte";
	import { graphql } from "$lib/graphql/generated";

	const ScreenerPageQuery = graphql(`
		query ScreenerPageQuery {
			viewer {
				id
				screenerMailbox: mailbox(type: screener) {
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
								from {
									id
									address
									name
									avatar
								}
								title
								lastMessageAt
							}
						}
					}
				}
			}
		}
	`);

	const screenerPageQuery = queryStore({
		client: getContextClient(),
		query: ScreenerPageQuery,
	});
	const screenerMailbox = $derived($screenerPageQuery.data?.viewer?.screenerMailbox);
</script>

<Navbar>
	{#snippet prepend()}
		<a href={resolve("/app/mail")} class="btn btn-accent">
			<ChevronLeftIcon />
			Important
		</a>
	{/snippet}
</Navbar>
<Container>
	<div class="flex w-full justify-between">
		<button class="btn btn-accent">Done</button>
		<button class="btn btn-circle btn-primary">
			<KeyIcon />
		</button>
	</div>
	<h1 class="text-5xl font-bold">The Screener</h1>
	<div class="text-lg">
		The threads below are from people trying to email you for the first time.
	</div>
	<div class="text-lg">You get to decide if you want to hear from them.</div>
	<div class="divider divider-start">Want to get emails from them?</div>
	{#each screenerMailbox?.unreadThreads.edges as { node } (node.id)}
		<div class="flex w-full items-center gap-2 border-b p-4">
			<div class="join">
				<button class="btn join-item btn-success"><ThumbsUpIcon /> Yes</button>
				<button class="btn join-item p-2 btn-success"><ChevronDownIcon /></button>
			</div>
			<button class="btn btn-warning"><ThumbsDownIcon /> No</button>
			<div class="ml-4 flex gap-2">
				<div class="avatar">
					<div class="w-16 rounded-full">
						<img src={node.from.avatar} />
					</div>
				</div>
				<div class="flex flex-col">
					<div class="flex gap-2">
						<div class="font-bold">{node.from.name}</div>
						<div class="text-accent-content">{node.from.address}</div>
					</div>
					<div>{node.title}</div>
				</div>
			</div>
		</div>
	{/each}
</Container>
