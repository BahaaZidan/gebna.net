<script lang="ts">
	import type { IconProps } from "@lucide/svelte";
	import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
	import MessageSquarePlusIcon from "@lucide/svelte/icons/message-square-plus";
	import SearchIcon from "@lucide/svelte/icons/search";
	import { type Component } from "svelte";

	let { children } = $props();
</script>

{#snippet iconButton({ label, Icon }: { label: string; Icon: Component<IconProps> })}
	<div class="tooltip tooltip-bottom" data-tip={label}>
		<button class="btn p-2 btn-ghost">
			<Icon />
		</button>
	</div>
{/snippet}

<div class="flex">
	<div class="flex h-screen w-[30%] max-w-[40%] flex-col border-r px-5 py-3">
		<div class="flex justify-between">
			<h1 class="font-mono text-2xl font-bold">gebna</h1>
			<div class="flex">
				{@render iconButton({ label: "New Chat", Icon: MessageSquarePlusIcon })}
				{@render iconButton({ label: "Menu", Icon: EllipsisVerticalIcon })}
			</div>
		</div>
		<form class="filter">
			<input class="btn btn-square" type="reset" value="×" />
			<input class="btn" type="radio" name="frameworks" aria-label="Svelte" />
			<input class="btn" type="radio" name="frameworks" aria-label="Vue" />
			<input class="btn" type="radio" name="frameworks" aria-label="React" />
		</form>
		<div class="flex flex-col">
			<h1>convo</h1>
			<h1>convo</h1>
			<h1>convo</h1>
			<h1>convo</h1>
			<h1>convo</h1>
			<h1>convo</h1>
			<h1>convo</h1>
		</div>
	</div>
	<div class="w-full">
		{@render children()}
	</div>
</div>
