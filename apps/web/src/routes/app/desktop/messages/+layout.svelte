<script lang="ts">
	import type { IconProps } from "@lucide/svelte";
	import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
	import MessageSquarePlusIcon from "@lucide/svelte/icons/message-square-plus";
	import SearchIcon from "@lucide/svelte/icons/search";
	import { type Component, type Snippet } from "svelte";

	import { resolve } from "$app/paths";

	import { formatInboxDate } from "$lib/format";

	import type { LayoutData } from "./$houdini";

	let props: { children: Snippet; data: LayoutData } = $props();
	let ConversationsListQuery = $derived(props.data.ConversationsListQuery);
	let conversations = $derived($ConversationsListQuery.data?.viewer?.conversations.edges);
</script>

{#snippet iconButton({ label, Icon }: { label: string; Icon: Component<IconProps> })}
	<div class="tooltip tooltip-bottom" data-tip={label}>
		<button class="btn p-2 btn-ghost">
			<Icon />
		</button>
	</div>
{/snippet}

<div class="flex">
	<div class="flex h-screen w-[40%] min-w-xs flex-col border-r px-5 py-3">
		<div class="flex justify-between">
			<h1 class="font-mono text-2xl font-bold">gebna</h1>
			<div class="flex">
				{@render iconButton({ label: "New Chat", Icon: MessageSquarePlusIcon })}
				{@render iconButton({ label: "Menu", Icon: EllipsisVerticalIcon })}
			</div>
		</div>
		<div class="flex flex-col overflow-y-scroll">
			{#if conversations}
				{#each conversations as { node } (node.id)}
					<a
						href={resolve("/app/desktop/messages/[conversation_id]", { conversation_id: node.id })}
						class="flex w-full items-center gap-3 p-3 hover:bg-base-100"
					>
						<img
							src="https://img.daisyui.com/images/profile/demo/batperson@192.webp"
							alt="I don't event know"
							class="size-12 object-contain"
						/>
						<div class="flex flex-col gap-1">
							<div class="font-semibold">{node.title}</div>
							<div class="line-clamp-1 text-sm">{node.kind}</div>
						</div>
						<div class="ml-auto text-sm">
							{formatInboxDate(node.updatedAt)}
						</div>
					</a>
				{/each}
			{/if}
		</div>
	</div>
	<div class="w-full">
		{@render props.children()}
	</div>
</div>
