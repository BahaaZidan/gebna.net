<script lang="ts">
	import type { IconProps } from "@lucide/svelte";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
	import MessageSquarePlusIcon from "@lucide/svelte/icons/message-square-plus";
	import { type Component, type Snippet } from "svelte";

	import { resolve } from "$app/paths";

	import ConversationAvatar from "$lib/components/mail/ConversationAvatar.svelte";
	import ConversationTitle from "$lib/components/mail/ConversationTitle.svelte";
	import { formatInboxDate } from "$lib/format";

	import type { LayoutData } from "./$houdini";

	let props: { children: Snippet; data: LayoutData } = $props();
	let ConversationsListQuery = $derived(props.data.ConversationsListQuery);
	let conversations = $derived($ConversationsListQuery.data?.viewer?.conversations.edges);
	let MainViewerQuery = $derived(props.data.MainViewerQuery);
	let viewer = $derived($MainViewerQuery.data?.viewer);
</script>

{#snippet iconButton({ label, Icon }: { label: string; Icon: Component<IconProps> })}
	<div class="tooltip tooltip-bottom" data-tip={label}>
		<button class="btn p-2 btn-ghost">
			<Icon />
		</button>
	</div>
{/snippet}

<div class="flex h-full min-h-0">
	<div class="flex h-full w-[40%] max-w-[40%] min-w-xs flex-col border-r px-5 py-3">
		<div class="flex justify-between">
			<h1 class="font-mono text-2xl font-bold">gebna</h1>
			<div class="flex">
				{@render iconButton({ label: "New Chat", Icon: MessageSquarePlusIcon })}
				{@render iconButton({ label: "Menu", Icon: EllipsisVerticalIcon })}
			</div>
		</div>
		<div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
			{#if conversations}
				{#each conversations as { node } (node.id)}
					<a
						href={resolve("/app/desktop/messages/[conversation_id]", { conversation_id: node.id })}
						class="group flex w-full items-center gap-3 p-3 hover:bg-base-200"
					>
						<ConversationAvatar conversation={node} class="size-12 min-h-12 min-w-12" />
						<div class="flex w-full flex-col gap-1">
							<div class="flex items-baseline justify-between">
								<div class="line-clamp-1 font-semibold">
									<ConversationTitle conversation={node} />
								</div>
								<div
									class={[
										"mx-px text-xs whitespace-nowrap",
										node.viewerState.unreadCount ? "text-primary-content" : "text-gray-400",
									]}
								>
									{formatInboxDate(node.updatedAt)}
								</div>
							</div>
							<div class="flex min-h-6 justify-between">
								<div class="line-clamp-1 min-w-0 text-sm wrap-anywhere text-gray-400">
									{node.lastMessage.bodyText}
								</div>
								<div class="flex gap-1">
									{#if node.viewerState.unreadCount}
										<div class="badge badge-primary">{node.viewerState.unreadCount}</div>
									{/if}
									<button class="btn hidden btn-ghost btn-xs group-hover:inline-flex">
										<ChevronDownIcon class="size-5.5" />
									</button>
								</div>
							</div>
						</div>
					</a>
				{/each}
			{/if}
		</div>
	</div>
	<div class="flex h-full min-h-0 w-full flex-col overflow-hidden">
		{@render props.children()}
	</div>
</div>
