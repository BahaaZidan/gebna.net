<script lang="ts">
	import ArrowRightLeftIcon from "@lucide/svelte/icons/arrow-right-left";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import NewspaperIcon from "@lucide/svelte/icons/newspaper";
	import ThumbsDownIcon from "@lucide/svelte/icons/thumbs-down";
	import ThumbsUpIcon from "@lucide/svelte/icons/thumbs-up";

	import { fragment, graphql, type ToBeScreenedContactListItem } from "$houdini";

	import MessageBody from "$lib/components/mail/MessageBody.svelte";
	import { assignTargetMailbox } from "$lib/graphql/mutations";

	let props: {
		contact: ToBeScreenedContactListItem;
	} = $props();
	let contact = $derived(
		fragment(
			props.contact,
			graphql(`
				fragment ToBeScreenedContactListItem on Contact {
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

<details class="collapse mb-2 border border-base-300 bg-base-100" bind:open={opened}>
	<summary class="collapse-title">
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
				<div class="join">
					<button
						class="btn join-item"
						onclick={() => {
							assignTargetMailbox({ contactID: $contact.id, targetMailboxType: "important" });
						}}
					>
						<ThumbsUpIcon /> Yes
					</button>
					<button
						class="btn join-item p-2"
						popovertarget="popover-{$contact.id}"
						style="anchor-name:--anchor-{$contact.id}"
					>
						<ChevronDownIcon />
					</button>
				</div>
				<button
					class="btn"
					onclick={() => {
						assignTargetMailbox({ contactID: $contact.id, targetMailboxType: "trash" });
					}}
				>
					<ThumbsDownIcon /> No
				</button>
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
<ul
	class="menu dropdown w-52 bg-neutral shadow-sm"
	popover
	id="popover-{$contact.id}"
	style="position-anchor:--anchor-{$contact.id}"
>
	<li>
		<button
			onclick={() => {
				assignTargetMailbox({ contactID: $contact.id, targetMailboxType: "news" });
			}}
		>
			<NewspaperIcon /> News
		</button>
	</li>
	<li>
		<button
			onclick={() => {
				assignTargetMailbox({ contactID: $contact.id, targetMailboxType: "transactional" });
			}}
		>
			<ArrowRightLeftIcon /> Transactional
		</button>
	</li>
</ul>
