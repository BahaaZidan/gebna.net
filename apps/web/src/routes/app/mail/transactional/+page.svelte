<script lang="ts">
	import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";

	import { resolve } from "$app/paths";

	import Container from "$lib/components/Container.svelte";
	import ThreadListItem from "$lib/components/mail/ThreadListItem.svelte";
	import Navbar from "$lib/components/Navbar.svelte";

	import type { PageData } from "./$houdini";

	let props: { data: PageData } = $props();

	const transactionalPageQuery = $derived(props.data.TransactionalPageQuery);
	const transactionalMailbox = $derived($transactionalPageQuery.data?.viewer?.transactionalMailbox);
</script>

<Navbar viewer={$transactionalPageQuery.data?.viewer}>
	{#snippet prepend()}
		<a href={resolve("/app/mail")} class="btn mr-2 btn-accent">
			<ChevronLeftIcon />
			Important
		</a>
	{/snippet}
</Navbar>

<Container>
	{#if transactionalMailbox}
		<h1 class="text-5xl font-bold">Transactional</h1>
		{#each transactionalMailbox.threads.edges as { node } (node.id)}
			<ThreadListItem thread={node} />
		{/each}
	{/if}
</Container>
