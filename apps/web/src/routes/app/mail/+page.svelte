<script lang="ts">
	import { getContextClient, queryStore } from "@urql/svelte";

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

{#if $viewerQuery.fetching}
	<p>Loading...</p>
{:else if $viewerQuery.error}
	<p>Oh no... {$viewerQuery.error.message}</p>
{:else}
	<ul>
		<li>{$viewerQuery.data?.viewer?.username}</li>
	</ul>
{/if}
