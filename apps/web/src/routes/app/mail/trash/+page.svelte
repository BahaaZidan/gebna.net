<script lang="ts">
	import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";

	import { resolve } from "$app/paths";

	import Container from "$lib/components/Container.svelte";
	import ThreadListItem from "$lib/components/mail/ThreadListItem.svelte";
	import Navbar from "$lib/components/Navbar.svelte";

	import type { PageData } from "./$houdini";

	let props: { data: PageData } = $props();

	let trashPageQuery = $derived(props.data.TrashPageQuery);
	let trashMailbox = $derived($trashPageQuery.data?.viewer?.trashMailbox);
</script>

<Navbar viewer={$trashPageQuery.data?.viewer}>
	{#snippet prepend()}
		<a href={resolve("/app/mail")} class="btn mr-2 btn-accent">
			<ChevronLeftIcon />
			Important
		</a>
	{/snippet}
</Navbar>

<Container>
	{#if trashMailbox}
		<h1 class="text-5xl font-bold">Trash</h1>
		{#each trashMailbox.threads.edges as { node } (node.id)}
			<ThreadListItem thread={node} />
		{/each}
	{/if}
</Container>
