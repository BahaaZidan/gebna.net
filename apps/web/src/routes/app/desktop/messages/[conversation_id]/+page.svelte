<script lang="ts">
	import { type IconProps } from "@lucide/svelte";
	import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
	import MicIcon from "@lucide/svelte/icons/mic";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import SearchIcon from "@lucide/svelte/icons/search";
	import { type Component } from "svelte";

	import ConversationAvatar from "$lib/components/mail/ConversationAvatar.svelte";
	import ConversationTitle from "$lib/components/mail/ConversationTitle.svelte";
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
	<div class="flex h-full min-h-0 flex-col">
		<div class="flex shrink-0 justify-between border-b p-3">
			<div class="flex items-center gap-2">
				<ConversationAvatar
					{conversation}
					viewerIdentityId={viewer?.identity.id}
					class="size-10 min-h-10 min-w-10"
				/>
				<div><ConversationTitle {conversation} viewerIdentityId={viewer.identity.id} /></div>
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
					<div class="chat-header">
						{node.sender.address}
						<time class="text-xs opacity-50">{formatInboxDate(node.createdAt)}</time>
					</div>
					<div class="chat-bubble">
						<div dir="auto" class="prose wrap-anywhere">{@html node.bodyMD}</div>
					</div>
					<div class="chat-footer opacity-50">Delivered</div>
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
				></textarea>
				<button class="btn btn-ghost">
					<MicIcon />
				</button>
			</div>
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
