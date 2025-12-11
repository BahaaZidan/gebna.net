<script lang="ts">
	import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
	import KeyIcon from "@lucide/svelte/icons/key";
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
	{#each screenerMailbox?.threads.edges as edge (edge.cursor)}
		<div>{edge.cursor}</div>
	{/each}
</Container>
