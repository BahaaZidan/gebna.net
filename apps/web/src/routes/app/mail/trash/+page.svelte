<script lang="ts">
	import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
	import { getContextClient, queryStore } from "@urql/svelte";

	import { resolve } from "$app/paths";

	import Container from "$lib/components/Container.svelte";
	import ThreadListItem from "$lib/components/mail/ThreadListItem.svelte";
	import Navbar from "$lib/components/Navbar.svelte";
	import { graphql } from "$lib/graphql/generated";

	const TrashPageQuery = graphql(`
		query TrashPageQuery {
			viewer {
				id
				username
				trashMailbox: mailbox(type: trash) {
					id
					type
					name
					threads {
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

	const trashPageQuery = queryStore({
		client: getContextClient(),
		query: TrashPageQuery,
	});
	const trashMailbox = $derived($trashPageQuery.data?.viewer?.trashMailbox);
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
	{#if trashMailbox}
		<h1 class="text-5xl font-bold">Trash</h1>
		{#each trashMailbox.threads.edges as { node } (node.id)}
			<ThreadListItem thread={node} />
		{/each}
	{/if}
</Container>
