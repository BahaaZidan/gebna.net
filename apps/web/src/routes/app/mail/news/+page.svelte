<script lang="ts">
	import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
	import { getContextClient, queryStore } from "@urql/svelte";

	import { resolve } from "$app/paths";

	import Container from "$lib/components/Container.svelte";
	import Avatar from "$lib/components/mail/Avatar.svelte";
	import Navbar from "$lib/components/Navbar.svelte";
	import { formatInboxDate } from "$lib/date";
	import { graphql } from "$lib/graphql/generated";
	import { autoIframeHeight } from "$lib/actions/autoIframeHeight";

	const NewsPageQuery = graphql(`
		query NewsPageQuery {
			viewer {
				id
				username
				newsMailbox: mailbox(type: news) {
					id
					type
					name
					threads(first: 5) {
						pageInfo {
							hasNextPage
							endCursor
						}
						edges {
							cursor
							node {
								id
								title
								messages {
									id
									from {
										id
										name
										avatar
										address
									}
									recievedAt
									bodyHTML
									bodyText
									to
								}
							}
						}
					}
				}
			}
		}
	`);

	const newsPageQuery = queryStore({
		client: getContextClient(),
		query: NewsPageQuery,
	});
	const newsMailbox = $derived($newsPageQuery.data?.viewer?.newsMailbox);
</script>

<Navbar>
	{#snippet prepend()}
		<a href={resolve("/app/mail")} class="btn mr-2 btn-accent">
			<ChevronLeftIcon />
			Important
		</a>
	{/snippet}
</Navbar>

<div class="mx-auto my-10 flex w-full max-w-6xl flex-col items-center p-5">
	<h1 class="mb-2 text-5xl font-bold">News</h1>
</div>
{#if newsMailbox}
	{#each newsMailbox.threads.edges as { node } (node.id)}
		<Container>
			{#if node}
				<h1 class="mb-2 text-4xl font-bold">{node.title}</h1>
				{#each node.messages as message (message.id)}
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
									<iframe
										title="email"
										sandbox="allow-same-origin"
										referrerpolicy="no-referrer"
										srcdoc={message.bodyHTML}
										class="w-full"
										use:autoIframeHeight
									></iframe>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			{/if}
		</Container>
	{/each}
{/if}
