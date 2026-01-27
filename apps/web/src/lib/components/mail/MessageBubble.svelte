<script lang="ts">
	import CheckCheckIcon from "@lucide/svelte/icons/check-check";
	import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
	import FileCodeIcon from "@lucide/svelte/icons/file-code";
	import SendIcon from "@lucide/svelte/icons/send";

	import { resolve } from "$app/paths";
	import { fragment, graphql, type MessageBubble } from "$houdini";

	import { floatingDropdown } from "$lib/actions/floating-dropdown";
	import { formatInboxDate } from "$lib/format";
	import { getViewer } from "$lib/graphql";

	let props: { message: MessageBubble; conversationId: string } = $props();
	let message = $derived(
		fragment(
			props.message,
			graphql(`
				fragment MessageBubble on Message {
					id
					bodyMD
					createdAt
					hasHTML
					sender {
						id
						address
						kind
						avatar
						name
					}
				}
			`)
		)
	);
	let viewer = getViewer();
	let bySelf = $derived($message.sender.id === viewer?.identity.id);
</script>

<div class={["chat", bySelf ? "chat-end" : "chat-start"]}>
	{#if !bySelf}
		<div class="avatar chat-image">
			<div class="w-10">
				<img
					alt="{$message.sender.name || $message.sender.address} avatar"
					src={$message.sender.avatar}
				/>
			</div>
		</div>
	{/if}
	<div class={["chat-header", bySelf && "flex-row-reverse"]}>
		{#if !bySelf}
			{$message.sender.name || $message.sender.address}
		{/if}
		<time class="text-xs opacity-50">{formatInboxDate($message.createdAt)}</time>
	</div>
	<div class="group chat-bubble">
		<details
			class={["dropdown absolute dropdown-start top-0", bySelf ? "-left-11" : "-right-11"]}
			use:floatingDropdown={{ placement: "bottom-start", offsetPx: 0 }}
		>
			<summary
				class="btn invisible size-11 list-none border-0 bg-base-300 p-0 group-focus-within:visible group-hover:visible group-has-[details[open]]:visible"
				aria-label="Open menu"
			>
				<EllipsisVerticalIcon class="size-4.5" />
			</summary>
			<ul class="dropdown-content menu z-1 w-52 rounded-box bg-base-200 p-2 shadow">
				{#if $message.hasHTML}
					<li>
						<a
							href={resolve("/app/desktop/messages/[conversation_id]/details/[message_id]/html", {
								conversation_id: props.conversationId,
								message_id: $message.id,
							})}
						>
							<FileCodeIcon class="size-5" /> HTML Version
						</a>
					</li>
				{/if}
				<li>
					<a
						href={resolve("/app/desktop/messages/[conversation_id]/details/[message_id]/delivery", {
							conversation_id: props.conversationId,
							message_id: $message.id,
						})}
					>
						<SendIcon class="size-5" /> Delivery Report
					</a>
				</li>
			</ul>
		</details>
		<div dir="auto" class="prose wrap-anywhere">{@html $message.bodyMD}</div>
	</div>
	<div class="chat-footer">
		<CheckCheckIcon class="size-4" /> Delivered
	</div>
</div>
