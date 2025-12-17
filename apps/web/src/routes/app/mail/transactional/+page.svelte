<script lang="ts">
	import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
	import { getContextClient, queryStore } from "@urql/svelte";

	import { resolve } from "$app/paths";

	import Container from "$lib/components/Container.svelte";
	import ThreadListItem from "$lib/components/mail/ThreadListItem.svelte";
	import Navbar from "$lib/components/Navbar.svelte";
	import { graphql } from "$lib/graphql/generated";

	const TransactionalPageQuery = graphql(`
		query TransactionalPageQuery {
			viewer {
				id
				username
				transactionalMailbox: mailbox(type: transactional) {
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

	const transactionalPageQuery = queryStore({
		client: getContextClient(),
		query: TransactionalPageQuery,
	});
	const transactionalMailbox = $derived($transactionalPageQuery.data?.viewer?.transactionalMailbox);
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
	{#if transactionalMailbox}
		<h1 class="text-5xl font-bold">Transactional</h1>
		{#each transactionalMailbox.threads.edges as { node } (node.id)}
			<ThreadListItem thread={node} />
		{/each}
	{/if}
</Container>
