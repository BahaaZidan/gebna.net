<script lang="ts">
	/* eslint-disable svelte/no-at-html-tags */
	import { graphql, useFragment, type FragmentType } from "@gebna/graphql-client";
	import CheckCheckIcon from "@lucide/svelte/icons/check-check";
	import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";

	import { floatingDropdown } from "../../actions";
	import { formatInboxDate } from "../../utils/format";

	const EmailMessageBubble = graphql(`
		fragment EmailMessageBubble on EmailMessage {
			id
			html
			createdAt
			from {
				id
				isSelf
				name
				avatar
				address
			}
		}
	`);

	let props: { message: FragmentType<typeof EmailMessageBubble> } = $props();
	let message = $derived(useFragment(EmailMessageBubble, props.message));
	let sender = $derived(message.from);
</script>

<div class={["chat", sender.isSelf ? "chat-end" : "chat-start"]}>
	{#if !sender.isSelf}
		<div class="avatar chat-image">
			<div class="w-10">
				<img alt="{sender.name || sender.address} avatar" src={sender.avatar} />
			</div>
		</div>
	{/if}
	<div class={["chat-header", sender.isSelf && "flex-row-reverse"]}>
		{#if !sender.isSelf}
			{sender.name || sender.address}
		{/if}
		<time class="text-xs opacity-50">{formatInboxDate(message.createdAt)}</time>
	</div>
	<div class="group chat-bubble">
		<details
			class={["dropdown absolute dropdown-start top-0", sender.isSelf ? "-left-11" : "-right-11"]}
			use:floatingDropdown={{ placement: "bottom-start", offsetPx: 0 }}
		>
			<summary
				class="btn invisible size-11 list-none border-0 bg-base-300 p-0 group-focus-within:visible group-hover:visible group-has-[details[open]]:visible"
				aria-label="Open menu"
			>
				<EllipsisVerticalIcon class="size-4.5" />
			</summary>
			<ul class="dropdown-content menu z-1 w-52 rounded-box bg-base-200 p-2 shadow">
				<li>Option</li>
			</ul>
		</details>
		<div dir="auto" class="prose wrap-anywhere">{@html message.html}</div>
	</div>
	<div class="chat-footer">
		<CheckCheckIcon class="size-4" /> Delivered
	</div>
</div>
