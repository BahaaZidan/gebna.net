<script lang="ts">
	import PlusIcon from "@lucide/svelte/icons/plus";
	import ThumbsDownIcon from "@lucide/svelte/icons/thumbs-down";
	import ThumbsUpIcon from "@lucide/svelte/icons/thumbs-up";

	import { resolve } from "$app/paths";

	import Container from "$lib/components/Container.svelte";
	import ThreadListItem from "$lib/components/mail/ThreadListItem.svelte";
	import Navbar from "$lib/components/Navbar.svelte";

	import type { PageData } from "./$houdini";

	let props: { data: PageData } = $props();
	let importantPageQuery = $derived(props.data.ImportantPageQuery);
	let importantSeenThreadsQuery = $derived(props.data.ImportantSeenThreadsQuery);
</script>

<Navbar viewer={$importantPageQuery.data?.viewer} />
<Container>
	{#if $importantPageQuery.fetching}
		<p>Loading...</p>
	{:else if $importantPageQuery.errors?.length}
		<p>Oh no... {$importantPageQuery.errors.map((e) => e.message).join(", ")}</p>
	{:else if $importantPageQuery.data?.viewer?.username}
		{@const viewer = $importantPageQuery.data.viewer}
		{@const seenThreads = $importantSeenThreadsQuery.data?.viewer?.importantMailbox?.seenThreads}

		<div class="flex w-full justify-between">
			<a
				href={resolve("/app/desktop/mail/screener")}
				class={["btn btn-accent", { invisible: !viewer.screenerMailbox?.assignedContactsCount }]}
			>
				<div class="flex">
					<ThumbsUpIcon class="size-5" />
					<ThumbsDownIcon class="size-5" />
				</div>
				Screen {viewer.screenerMailbox?.assignedContactsCount} first-time senders
			</a>

			<button class="btn btn-primary">
				<PlusIcon />
				Write
			</button>
		</div>
		<h1 class="text-5xl font-bold">Important</h1>
		{#if viewer.importantMailbox?.unseenThreads.edges.length}
			<div class="divider divider-start">New for you</div>
			<div class="flex w-full flex-col gap-2">
				{#each viewer.importantMailbox?.unseenThreads.edges as { node } (node.id)}
					<ThreadListItem thread={node} />
				{/each}
			</div>
		{:else}
			<div class="flex h-64 w-full items-center justify-center">You're all caught up ✨</div>
		{/if}
		<div class="divider divider-start">Previously seen</div>
		{#each seenThreads?.edges as { node } (node.id)}
			<ThreadListItem thread={node} />
		{/each}
	{/if}
</Container>
