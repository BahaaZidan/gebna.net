<script lang="ts">
	import ThumbsDownIcon from "@lucide/svelte/icons/thumbs-down";
	import ThumbsUpIcon from "@lucide/svelte/icons/thumbs-up";

	import { fragment, graphql, type ToBeScreenedContactListItem } from "$houdini";

	import AssignTargetMailboxButton from "$lib/components/mail/AssignTargetMailboxButton.svelte";
	import MessageBody from "$lib/components/mail/MessageBody.svelte";

	let props: {
		contact: ToBeScreenedContactListItem;
	} = $props();
	let contact = $derived(
		fragment(
			props.contact,
			graphql(`
				fragment ToBeScreenedContactListItem on Contact {
					...AssignTargetMailboxButton
					id
					address
					name
					avatar
					firstMessage {
						id
						subject
					}
				}
			`)
		)
	);
	let firstMessage = $derived($contact.firstMessage!);

	let ToBeScreenedMessageQuery = graphql(`
		query ToBeScreenedMessageQuery($id: ID!) {
			node(id: $id) {
				... on Message {
					id
					...MessageBody
				}
			}
		}
	`);
	let firstMessageBody = $derived(
		$ToBeScreenedMessageQuery.data?.node?.__typename === "Message"
			? $ToBeScreenedMessageQuery.data?.node
			: null
	);
	let opened = $state(false);
	$effect(() => {
		if (firstMessageBody || !opened || !$contact.firstMessage?.id) return;
		ToBeScreenedMessageQuery.fetch({ variables: { id: $contact.firstMessage.id } });
	});
</script>

<details
	class="collapse relative mb-2 overflow-visible border border-base-300 bg-base-100"
	bind:open={opened}
>
	<summary class="collapse-title sticky top-0 z-20 block border-b border-base-300 bg-base-100">
		<div class="flex w-full items-center justify-between gap-2">
			<div class="ml-4 flex items-center gap-3">
				<div class="avatar">
					<div class="size-12">
						<img src={$contact.avatar} alt="{$contact.name} avatar" />
					</div>
				</div>
				<div class="flex flex-col">
					<div class="flex gap-2">
						<div class="font-bold whitespace-nowrap">{$contact.name}</div>
						<div class="line-clamp-1 wrap-anywhere text-accent-content">{$contact.address}</div>
					</div>
					<div>{firstMessage.subject}</div>
				</div>
			</div>
			<div class="flex gap-2">
				<AssignTargetMailboxButton contact={$contact} class="btn hover:bg-accent">
					<div class="flex">
						<ThumbsUpIcon class="size-5" />
						<ThumbsDownIcon class="size-5" />
					</div>
					Screen
				</AssignTargetMailboxButton>
			</div>
		</div>
	</summary>
	<div class="collapse-content">
		{#if $ToBeScreenedMessageQuery.fetching}
			<div class="flex w-full justify-center">
				<span class="loading loading-xl loading-spinner"></span>
			</div>
		{:else if $ToBeScreenedMessageQuery.errors}
			<span>Something went wrong!</span>
		{:else if firstMessageBody}
			<MessageBody message={firstMessageBody} />
		{/if}
	</div>
</details>
