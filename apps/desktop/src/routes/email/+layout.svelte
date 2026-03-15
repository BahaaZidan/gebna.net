<script lang="ts">
	import { formatInboxDate, ThreadAvatar, ThreadTitle } from "@gebna/ui";
	import {
		CaretDownIcon,
		NotePencilIcon,
		PlusIcon,
		type IconComponentProps,
	} from "phosphor-svelte";
	import { type Component } from "svelte";

	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import type { Pathname } from "$app/types";

	import { getEmailConvoList } from "$lib/email.remote";

	let { children } = $props();

	let response = await getEmailConvoList();
	let threads = $derived(response.data?.viewer?.emailThreads.edges);
</script>

{#snippet iconButton({ label, Icon }: { label: string; Icon: Component<IconComponentProps> })}
	<div class="tooltip tooltip-bottom" data-tip={label}>
		<button class="btn p-2 btn-ghost">
			<Icon class="size-6" />
		</button>
	</div>
{/snippet}

<div class="flex h-full min-h-0">
	<div class="flex h-full w-[40%] max-w-[40%] min-w-xs flex-col gap-1 border-r py-3">
		<div class="flex justify-between px-5">
			<h1 class="font-mono text-2xl font-bold">gebna</h1>
			<div class="flex">
				{@render iconButton({ label: "New Mail", Icon: NotePencilIcon })}
			</div>
		</div>
		<div class="flex gap-2 px-5">
			<button class="btn btn-active">All</button>
			<button class="btn btn-ghost">Unseen</button>
			<div class="tooltip tooltip-right" data-tip="New List">
				<button class="btn btn-ghost"><PlusIcon class="size-4.5" /></button>
			</div>
		</div>
		<div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
			{#each threads as { node } (node.id)}
				<a
					href={resolve("/email/[thread_id]", { thread_id: node.id })}
					class={[
						"group flex w-full items-center gap-3 px-5 py-3 hover:bg-base-200",
						page.url.pathname === (`/email/${node.id}` as Pathname) ? "bg-base-200" : null,
					]}
				>
					<ThreadAvatar thread={node} class="size-12 min-h-12 min-w-12" />
					<div class="flex w-full flex-col gap-1">
						<div class="flex items-baseline justify-between">
							<div class="line-clamp-1 font-semibold">
								<ThreadTitle thread={node} />
							</div>
							<div
								class={[
									"mx-px text-xs whitespace-nowrap",
									node.unseenCount ? "text-primary-content" : "text-gray-400",
								]}
							>
								{formatInboxDate(node.lastMessage.createdAt)}
							</div>
						</div>
						<div class="flex min-h-6 justify-between">
							<div class="line-clamp-1 min-w-0 text-sm wrap-anywhere text-gray-400">
								{node.lastMessage.snippet}
							</div>
							<div class="flex gap-1">
								{#if node.unseenCount}
									<div class="badge badge-primary">{node.unseenCount}</div>
								{/if}
								<button class="btn hidden btn-ghost btn-xs group-hover:inline-flex">
									<CaretDownIcon class="size-5.5" />
								</button>
							</div>
						</div>
					</div>
				</a>
			{/each}
		</div>
	</div>
	<div class="flex h-full min-h-0 w-full flex-col overflow-hidden">
		{@render children()}
	</div>
</div>
