<script lang="ts">
	import { MessageBubble, ThreadTitle } from "@gebna/ui";
	import { createInfiniteQuery } from "@tanstack/svelte-query";
	import DotsThreeOutlineVerticalIcon from "phosphor-svelte/lib/DotsThreeOutlineVerticalIcon";

	import { page } from "$app/state";

	import { getEmailThreadDetails } from "$lib/email.remote";

	const pageSize = 15;
	type MessagesParams = Parameters<typeof getEmailThreadDetails>[number];
	let initialPageParam: MessagesParams = {
		id: page.params.thread_id,
		messagesPagination: { first: pageSize },
	};
	let initialPage = await getEmailThreadDetails(initialPageParam);
	let query = createInfiniteQuery(() => ({
		queryKey: ["email_thread_details", page.params.thread_id],
		queryFn: async ({ pageParam }: { pageParam: MessagesParams }) =>
			await getEmailThreadDetails(pageParam),
		initialPageParam,
		getNextPageParam: (lastPage) => {
			let thread = lastPage?.data?.node?.__typename === "EmailThread" ? lastPage.data.node : null;
			if (!thread?.messages.pageInfo.hasNextPage) return;
			return {
				id: page.params.thread_id,
				messagesPagination: {
					first: pageSize,
					after: thread.messages.pageInfo.endCursor as string,
				},
			};
		},
		initialData: {
			pages: [initialPage],
			pageParams: [initialPageParam],
		},
		refetchOnMount: false,
	}));

	let thread = $derived(
		initialPage?.data?.node?.__typename === "EmailThread" ? initialPage.data.node : null
	);
	let messages = $derived(
		query.data?.pages.flatMap((page) =>
			page?.data?.node?.__typename !== "EmailThread" ? [] : page.data.node.messages.edges
		) ?? []
	);
</script>

{#if thread}
	<div class="flex h-full min-h-0 flex-col">
		<div class="flex shrink-0 justify-between border-b p-3">
			<div class="flex items-center gap-2">
				<div class="text-lg"><ThreadTitle {thread} /></div>
			</div>
			<div class="flex">
				<div class="tooltip tooltip-bottom" data-tip="Options">
					<button class="btn p-2 btn-ghost">
						<DotsThreeOutlineVerticalIcon weight="fill" class="size-5.5" />
					</button>
				</div>
			</div>
		</div>
		<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
			{#each messages as { node }, index (node.id)}
				<MessageBubble message={node} />
				{#if index + 1 < thread.messages.edges.length}
					<hr class="border border-base-200" />
				{/if}
			{/each}
			{#if query.hasNextPage}
				<button class="btn" disabled={query.isFetching} onclick={() => query.fetchNextPage()}>
					Load more
					<span
						class={[
							"loading loading-md loading-spinner",
							query.isFetching ? "visible" : "invisible",
						]}
					></span>
				</button>
			{/if}
		</div>
	</div>
{/if}
