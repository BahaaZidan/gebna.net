<script lang="ts">
	import { formatInboxDate } from "$lib/format";

	import type { PageData } from "./$houdini";

	let props: { data: PageData } = $props();

	let ConversationDetailsQuery = $derived(props.data.ConversationDetailsQuery);
	let conversation = $derived(
		$ConversationDetailsQuery.data?.node?.__typename === "Conversation"
			? $ConversationDetailsQuery.data?.node
			: null
	);

	let MainViewerQuery = $derived(props.data.MainViewerQuery);
	let viewer = $derived($MainViewerQuery.data?.viewer);
</script>

{#if conversation && viewer}
	<div class="flex flex-col-reverse">
		{#each conversation.messages.edges as { node } (node.id)}
			<div class={["chat", node.sender.id === viewer.identity.id ? "chat-end" : "chat-start"]}>
				<div class="avatar chat-image">
					<div class="w-10 rounded-full">
						<img
							alt="Tailwind CSS chat bubble component"
							src="https://img.daisyui.com/images/profile/demo/kenobee@192.webp"
						/>
					</div>
				</div>
				<div class="chat-header">
					{node.sender.address}
					<time class="text-xs opacity-50">{formatInboxDate(node.createdAt)}</time>
				</div>
				<div class="chat-bubble">{node.bodyText}</div>
				<div class="chat-footer opacity-50">Delivered</div>
			</div>
		{/each}
	</div>
{/if}
