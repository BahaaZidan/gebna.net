<script lang="ts">
	import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";

	import { resolve } from "$app/paths";

	import Container from "$lib/components/Container.svelte";
	import Navbar from "$lib/components/Navbar.svelte";

	import type { PageData } from "./$houdini";
	import ToBeScreenedContactListItem from "./components/ToBeScreenedContactListItem.svelte";

	let props: { data: PageData } = $props();
	let screenerPageQuery = $derived(props.data.ScreenerPageQuery);
	let screenerMailbox = $derived($screenerPageQuery.data?.viewer?.screenerMailbox);
</script>

<Navbar viewer={$screenerPageQuery.data?.viewer}>
	{#snippet prepend()}
		<a href={resolve("/app/desktop/mail")} class="btn mr-2 btn-accent">
			<ChevronLeftIcon />
			Important
		</a>
	{/snippet}
</Navbar>
<Container>
	<h1 class="text-5xl font-bold">The Screener</h1>
	<div class="text-lg">
		The threads below are from people trying to email you for the first time.
	</div>
	<div class="text-lg">You get to decide if you want to hear from them.</div>
	<div class="divider divider-start">Want to get emails from them?</div>
	{#each screenerMailbox?.contacts.edges as { node } (node.id)}
		<ToBeScreenedContactListItem contact={node} />
	{/each}
</Container>
