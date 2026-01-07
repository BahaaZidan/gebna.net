<script lang="ts">
	import type { IconProps } from "@lucide/svelte";
	import BookOpenIcon from "@lucide/svelte/icons/book-open";
	import ReceiptTextIcon from "@lucide/svelte/icons/receipt-text";
	import StarIcon from "@lucide/svelte/icons/star";
	import TrashIcon from "@lucide/svelte/icons/trash-2";
	import type { Component, Snippet } from "svelte";
	import type { ClassValue } from "svelte/elements";

	import {
		cache,
		fragment,
		graphql,
		type AssignTargetMailboxButton,
		type MailboxType$options,
	} from "$houdini";

	import Portal from "$lib/components/Portal.svelte";

	let props: {
		children: Snippet;
		class: ClassValue;
		contact: AssignTargetMailboxButton;
	} = $props();

	let contact = $derived(
		fragment(
			props.contact,
			graphql(`
				fragment AssignTargetMailboxButton on Contact {
					id
					targetMailbox {
						id
						name
						type
					}
				}
			`)
		)
	);

	let modal: HTMLDialogElement;

	interface MailBoxListItemProps {
		name: string;
		type: MailboxType$options;
		description: string;
		Icon: Component<IconProps, {}, "">;
	}

	const AssignTargetMailboxMutation = graphql(`
		mutation AssignTargetMailboxMutation($input: AssignTargetMailboxInput!) {
			assignTargetMailbox(input: $input) {
				...Screener_Mailbox_Contacts_remove
				id
				name
				avatar
				address
				targetMailbox {
					id
					name
					type
				}
			}
		}
	`);
</script>

{#snippet MailBoxListItem({ Icon, type, name, description }: MailBoxListItemProps)}
	<button
		class="flex items-center gap-2 bg-base-200 p-2 hover:cursor-pointer hover:bg-accent disabled:cursor-not-allowed"
		disabled={$contact.targetMailbox.type === type}
		onclick={async () => {
			await AssignTargetMailboxMutation.mutate({
				input: {
					contactID: $contact.id,
					targetMailboxType: type,
				},
			});
			cache.markStale("User", {
				when: {
					// TODO: this seems to invalidate all user instances not just the specific type. It works UX-wise. So we'll keep it for now.
					type,
				},
			});
			modal.close();
		}}
	>
		<Icon class="size-8 min-h-8 min-w-8" />
		<div class="flex flex-col items-start gap-1">
			<div class="font-semibold">{name}</div>
			<div class="text-start text-xs">{description}</div>
		</div>
	</button>
{/snippet}

<button class={props.class} onclick={() => modal.showModal()}>
	{@render props.children()}
</button>
<Portal>
	<dialog bind:this={modal} class="modal">
		<div class="modal-box border">
			{#if $AssignTargetMailboxMutation.fetching}
				<div
					class="absolute inset-0 z-50 grid place-items-center rounded-box bg-base-100/50 backdrop-blur-[1px]"
					aria-busy="true"
					aria-live="polite"
				>
					<div class="flex items-center gap-3">
						<span class="loading loading-lg loading-spinner"></span>
					</div>
				</div>
			{/if}
			<div class="flex w-full flex-col">
				<div class="flex flex-col gap-3">
					<div class="divider">Wanna hear from them ?</div>
					{@render MailBoxListItem({
						Icon: StarIcon,
						type: "important",
						name: "Important",
						description: "This is where you keep anything that needs your attention.",
					})}
					{@render MailBoxListItem({
						Icon: BookOpenIcon,
						name: "News",
						type: "news",
						description: "Reading experience optimized for newsletters.",
					})}
					{@render MailBoxListItem({
						Icon: ReceiptTextIcon,
						type: "transactional",
						name: "Transactional",
						description:
							"Invoices, notifications, and anything you wish to keep but don't need to read.",
					})}
					<div class="divider">Wanna block them ?</div>
					{@render MailBoxListItem({
						Icon: TrashIcon,
						type: "trash",
						name: "Trash",
						description:
							"You won't hear from them again. Their messages will be deleted within 7 days.",
					})}
				</div>
			</div>
			<div class="modal-action">
				<form method="dialog">
					<button class="btn hover:bg-accent">Cancel</button>
				</form>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button>close</button>
		</form>
	</dialog>
</Portal>
