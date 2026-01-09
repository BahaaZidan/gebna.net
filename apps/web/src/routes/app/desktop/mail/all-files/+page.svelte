<script lang="ts">
	import AsteriskIcon from "@lucide/svelte/icons/asterisk";
	import UsersRoundIcon from "@lucide/svelte/icons/users-round";
	import { useSearchParams } from "runed/kit";

	import Container from "$lib/components/Container.svelte";
	import AttachmentListItem from "$lib/components/mail/AttachmentListItem.svelte";
	import Navbar from "$lib/components/Navbar.svelte";
	import { ATTACHMENT_TYPES } from "$lib/mail";

	import type { PageData } from "./$houdini";
	import { searchParamsSchema } from "./schema";

	let props: { data: PageData } = $props();
	let allFilesPageQuery = $derived(props.data.AllFilesPageQuery);
	let attachments = $derived($allFilesPageQuery.data?.viewer?.attachments.edges.map((e) => e.node));
	let contacts = $derived($allFilesPageQuery.data?.viewer?.contacts.edges.map((e) => e.node));

	let params = useSearchParams(searchParamsSchema, { pushHistory: false });
</script>

<Navbar viewer={$allFilesPageQuery.data?.viewer} />
<Container>
	<h1 class="divider text-5xl font-semibold">All Files</h1>
	<h3 class="mt-2 flex items-baseline gap-1">
		<select class="select" bind:value={params.attachmentType}>
			<option value=""><AsteriskIcon /> All Files</option>
			{#each ATTACHMENT_TYPES as at (at.type)}
				<option value={at.type}><at.icon /> {at.name}</option>
			{/each}
		</select>

		<span class="w-40 text-lg">sent by</span>

		<select class="select" bind:value={params.contactAddress}>
			<option value=""><UsersRoundIcon /> everyone</option>
			{#each contacts as c (c.id)}
				<option value={c.address}>{c.name}</option>
			{/each}
		</select>
	</h3>
	<div class="mt-3 flex w-full flex-wrap justify-center gap-4">
		{#each attachments as attachment (attachment.id)}
			<AttachmentListItem {attachment} />
		{/each}
	</div>
</Container>
