<script lang="ts">
	import { MessageBubble, ThreadTitle } from "@gebna/ui";
	import { DotsThreeOutlineVerticalIcon } from "phosphor-svelte";

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
				<div class="tooltip tooltip-bottom" data-tip="Options">
					<button class="btn p-2 btn-ghost">
						<DotsThreeOutlineVerticalIcon weight="fill" class="size-5.5" />
					</button>
				</div>
			</div>
		</div>
		<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
			{#each thread.messages.edges as { node } (node.id)}
				<MessageBubble message={node} />
			{/each}
		</div>
	</div>
{/if}
