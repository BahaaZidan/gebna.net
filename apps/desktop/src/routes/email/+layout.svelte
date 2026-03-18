<script lang="ts">
	import { formatInboxDate, ThreadAvatar, ThreadTitle } from "@gebna/ui";
	import { createInfiniteQuery } from "@tanstack/svelte-query";
	import type { IconComponentProps } from "phosphor-svelte";
	import CaretDownIcon from "phosphor-svelte/lib/CaretDownIcon";
	import NotePencilIcon from "phosphor-svelte/lib/NotePencilIcon";
	import { type Component } from "svelte";

	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import type { Pathname } from "$app/types";

	import { getEmailThreadsConnection } from "$lib/email.remote";

	let { children } = $props();

	const pageSize = 25;
	type EmailThreadsPageParam = { first: number; after?: string };
	let initialPageParam: EmailThreadsPageParam = { first: pageSize };
	let initialPage = await getEmailThreadsConnection(initialPageParam);
	let query = createInfiniteQuery(() => ({
		queryKey: ["email_threads_connection"],
		queryFn: async ({ pageParam }: { pageParam: EmailThreadsPageParam }) =>
			await getEmailThreadsConnection(pageParam),
		initialPageParam,
		getNextPageParam: (lastPage) => {
			let pageInfo = lastPage.data?.viewer?.emailThreads.pageInfo;
			if (!pageInfo?.hasNextPage) return;
			return {
				first: pageSize,
				after: pageInfo.endCursor as string,
			};
		},
		initialData: {
			pages: [initialPage],
			pageParams: [initialPageParam],
		},
		refetchOnMount: false,
	}));

	let threads = $derived(
		query.data?.pages.flatMap((page) => page.data?.viewer?.emailThreads.edges ?? []) ?? []
	);
</script>

<div class="flex h-full min-h-0">
	<div class="flex h-full w-[50%] max-w-[50%] min-w-md flex-col gap-1 border-r py-3">
		<div class="flex justify-between px-5">
			<h1 class="font-mono text-2xl font-bold">gebna</h1>
			<div class="flex">
				{@render iconButton({ label: "New Mail", Icon: NotePencilIcon })}
			</div>
		</div>
		<div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
			{#each threads as { node } (node.id)}
				<a
					href={resolve("/email/[thread_id]", { thread_id: node.id })}
					class={[
						"group flex w-full items-center gap-3 px-5 py-3 hover:bg-base-200",
						page.url.pathname === (`/email/${node.id}` as Pathname) ? "bg-base-300" : null,
					]}
				>
					<ThreadAvatar thread={node} class="size-12 min-h-12 min-w-12" />
					<div class="flex w-full flex-col gap-1">
						<div class="flex items-baseline justify-between">
							<div class="line-clamp-1 min-w-0 text-sm wrap-anywhere text-gray-400">
								{node.lastMessage.from.name || node.lastMessage.from.address}
							</div>
							<div
								class={[
									"mx-px text-xs whitespace-nowrap",
									node.unseenCount ? "text-primary-content" : "text-gray-400",
								]}
							>
								{formatInboxDate(node.lastMessage.createdAt)}
							</div>
						</div>
						<div class="flex min-h-6 justify-between">
							<div class="line-clamp-1 font-semibold">
								<ThreadTitle thread={node} />
							</div>
							<div class="flex gap-1">
								{#if node.unseenCount}
									<div class="badge badge-primary">{node.unseenCount}</div>
								{/if}
								<button
									class="btn hidden btn-ghost btn-xs group-hover:inline-flex"
									onclick={(e) => {
										e.preventDefault();
									}}
								>
									<CaretDownIcon class="size-5.5" />
								</button>
							</div>
						</div>
					</div>
				</a>
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
	<div class="flex h-full min-h-0 w-full flex-col overflow-hidden">
		{@render children()}
	</div>
</div>

{#snippet iconButton({ label, Icon }: { label: string; Icon: Component<IconComponentProps> })}
	<div class="tooltip tooltip-bottom" data-tip={label}>
		<button class="btn p-2 btn-ghost">
			<Icon class="size-6" />
		</button>
	</div>
{/snippet}
