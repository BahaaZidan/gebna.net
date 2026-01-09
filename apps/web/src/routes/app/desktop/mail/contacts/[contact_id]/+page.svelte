<script lang="ts">
	import BellOffIcon from "@lucide/svelte/icons/bell-off";
	import TagIcon from "@lucide/svelte/icons/tag";

	import Container from "$lib/components/Container.svelte";
	import AssignTargetMailboxButton from "$lib/components/mail/AssignTargetMailboxButton.svelte";
	import AttachmentListItem from "$lib/components/mail/AttachmentListItem.svelte";
	import ThreadListItem from "$lib/components/mail/ThreadListItem.svelte";
	import Navbar from "$lib/components/Navbar.svelte";
	import { TARGET_MAILBOXES } from "$lib/mail";

	import type { PageData } from "./$houdini";

	let props: { data: PageData } = $props();

	let contactDetailsPageQuery = $derived(props.data.ContactDetailsPageQuery);
	let contact = $derived(
		$contactDetailsPageQuery.data?.node?.__typename === "Contact"
			? $contactDetailsPageQuery.data?.node
			: null
	);
</script>

<Navbar viewer={$contactDetailsPageQuery.data?.viewer} />
<Container>
	{#if contact}
		{@const TargetMailboxIcon =
			TARGET_MAILBOXES[TARGET_MAILBOXES.findIndex((mb) => mb.type === contact.targetMailbox.type)]
				.icon}
		<div class="flex w-full justify-end">
			<button class="btn btn-outline btn-primary">Edit Contact</button>
		</div>
		<div class="avatar">
			<div class="w-20 rounded-full">
				<img src={contact.avatar} alt="{contact.name} avatar" />
			</div>
		</div>
		<h1 class="text-3xl font-semibold">{contact.name}</h1>
		<h3>{contact.address}</h3>
		<div class="flex w-full justify-center gap-3 bg-base-100 p-2">
			<button class="btn btn-ghost"><BellOffIcon /> Not notifying</button>
			<AssignTargetMailboxButton {contact} class="btn btn-ghost">
				<TargetMailboxIcon /> Delivering to {contact.targetMailbox.name}
			</AssignTargetMailboxButton>
			<button class="btn btn-ghost"><TagIcon /> Autofile in...</button>
		</div>
		{#if contact.attachments.edges.length}
			<div class="divider divider-start">Files</div>
			<div class="flex w-full flex-wrap justify-center gap-2">
				{#each contact.attachments.edges as { node } (node.id)}
					<AttachmentListItem attachment={node} />
				{/each}
			</div>
		{/if}
		<div class="divider divider-start">Threads</div>
		{#each contact.threads.edges as { node } (node.id)}
			<ThreadListItem thread={node} />
		{/each}
	{/if}
</Container>
