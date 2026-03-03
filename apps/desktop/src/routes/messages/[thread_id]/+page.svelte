<script lang="ts">
	import { MessageBubble, ThreadTitle } from "@gebna/ui";
	import { type IconProps } from "@lucide/svelte";
	import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
	import SearchIcon from "@lucide/svelte/icons/search";
	import { type Component } from "svelte";

	import { page } from "$app/state";

	import { getEmailThreadDetails } from "$lib/email.remote";

	let ThreadDetailsQueryResult = $derived(await getEmailThreadDetails(page.params.thread_id));
	let thread = $derived(
		ThreadDetailsQueryResult?.data?.node?.__typename === "EmailThread"
			? ThreadDetailsQueryResult.data.node
			: null
	);
</script>

{#if thread}
	<div class="flex h-full min-h-0 flex-col">
		<div class="flex shrink-0 justify-between border-b p-3">
			<div class="flex items-center gap-2">
				<div class="text-lg"><ThreadTitle {thread} /></div>
			</div>
			<div class="flex">
				{@render iconButton({ label: "Search", Icon: SearchIcon })}
				{@render iconButton({ label: "Menu", Icon: EllipsisVerticalIcon })}
			</div>
		</div>
		<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
			{#each thread.messages.edges as { node } (node.id)}
				<MessageBubble message={node} />
			{/each}
		</div>
	</div>
{/if}

{#snippet iconButton({ label, Icon }: { label: string; Icon: Component<IconProps> })}
	<div class="tooltip tooltip-bottom" data-tip={label}>
		<button class="btn p-2 btn-ghost">
			<Icon />
		</button>
	</div>
{/snippet}
