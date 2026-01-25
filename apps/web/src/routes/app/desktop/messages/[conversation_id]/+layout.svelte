<script lang="ts">
	import { type IconProps } from "@lucide/svelte";
	import CheckCheckIcon from "@lucide/svelte/icons/check-check";
	import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
	import FileCodeIcon from "@lucide/svelte/icons/file-code";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import SearchIcon from "@lucide/svelte/icons/search";
	import SendIcon from "@lucide/svelte/icons/send";
	import SendHorizontalIcon from "@lucide/svelte/icons/send-horizontal";
	import { type Component, type Snippet } from "svelte";

	import { resolve } from "$app/paths";
	import { graphql } from "$houdini";

	import { floatingDropdown } from "$lib/actions/floating-dropdown";
	import ConversationAvatar from "$lib/components/mail/ConversationAvatar.svelte";
	import ConversationTitle from "$lib/components/mail/ConversationTitle.svelte";
	import { formatInboxDate } from "$lib/format";

	import type { LayoutData } from "./$houdini";

	let props: { children: Snippet; data: LayoutData } = $props();

	let ConversationDetailsQuery = $derived(props.data.ConversationDetailsQuery);
	let conversation = $derived(
		$ConversationDetailsQuery.data?.node?.__typename === "Conversation"
			? $ConversationDetailsQuery.data?.node
			: null
	);

	let MainViewerQuery = $derived(props.data.MainViewerQuery);
	let viewer = $derived($MainViewerQuery.data?.viewer);

	const SendMessageMutation = graphql(`
		mutation SendMessageMutation($input: SendMessageInput!) {
			sendMessage(input: $input) {
				...Conversation_Messages_insert @prepend
				id
				createdAt
				bodyMD
			}
		}
	`);
	let messageVal = $state("");
	async function sendMessage() {
		if (!conversation) return;
		await SendMessageMutation.mutate({
			input: {
				bodyMD: messageVal,
				conversationId: conversation.id,
			},
		});
		messageVal = "";
	}
</script>

{#if conversation && viewer}
	<div class="flex h-full min-h-0 flex-col">
		<div class="flex shrink-0 justify-between border-b p-3">
			<div class="flex items-center gap-2">
				<ConversationAvatar {conversation} class="size-10 min-h-10 min-w-10" />
				<div><ConversationTitle {conversation} /></div>
			</div>
			<div class="flex">
				{@render iconButton({ label: "Search", Icon: SearchIcon })}
				{@render iconButton({ label: "Menu", Icon: EllipsisVerticalIcon })}
			</div>
		</div>
		<div class="flex min-h-0 flex-1 flex-col-reverse gap-4 overflow-y-auto p-3">
			{#each conversation.messages.edges as { node } (node.id)}
				{@const bySelf = node.sender.id === viewer.identity.id}
				<div class={["chat", bySelf ? "chat-end" : "chat-start"]}>
					{#if !bySelf}
						<div class="avatar chat-image">
							<div class="w-10">
								<img
									alt="{node.sender.name || node.sender.address} avatar"
									src={node.sender.avatar}
								/>
							</div>
						</div>
					{/if}
					<div class={["chat-header", bySelf && "flex-row-reverse"]}>
						{#if !bySelf}
							{node.sender.name || node.sender.address}
						{/if}
						<time class="text-xs opacity-50">{formatInboxDate(node.createdAt)}</time>
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
								{#if node.hasHTML}
									<li>
										<a
											href={resolve(
												"/app/desktop/messages/[conversation_id]/details/[message_id]/html",
												{ conversation_id: conversation.id, message_id: node.id }
											)}
										>
											<FileCodeIcon class="size-5" /> HTML Version
										</a>
									</li>
								{/if}
								<li>
									<a
										href={resolve(
											"/app/desktop/messages/[conversation_id]/details/[message_id]/delivery",
											{ conversation_id: conversation.id, message_id: node.id }
										)}
									>
										<SendIcon class="size-5" /> Delivery Report
									</a>
								</li>
							</ul>
						</details>
						<div dir="auto" class="prose wrap-anywhere">{@html node.bodyMD}</div>
					</div>
					<div class="chat-footer">
						<CheckCheckIcon class="size-4" /> Delivered
					</div>
				</div>
			{/each}
		</div>
		<div class="flex shrink-0 flex-col gap-2 border-t p-3">
			<div class="flex w-full items-end gap-2">
				<button class="btn btn-ghost">
					<PlusIcon />
				</button>
				<textarea
					class="textarea-bordered textarea grow resize-none"
					rows="1"
					placeholder="Message"
					bind:value={messageVal}
					disabled={$SendMessageMutation.fetching}
				></textarea>
				<button
					disabled={$SendMessageMutation.fetching}
					onclick={sendMessage}
					class="btn btn-ghost"
				>
					<SendHorizontalIcon />
				</button>
			</div>
		</div>
	</div>

	{@render props.children()}
{/if}

{#snippet iconButton({ label, Icon }: { label: string; Icon: Component<IconProps> })}
	<div class="tooltip tooltip-bottom" data-tip={label}>
		<button class="btn p-2 btn-ghost">
			<Icon />
		</button>
	</div>
{/snippet}
