<script lang="ts">
	import { formatInboxDate } from "$lib/date";
	import { graphql, useFragment, type FragmentType } from "$lib/graphql/generated";
	import { ATTACHMENT_TYPE_TO_ICONS } from "$lib/mail";

	const AttachmentListItem = graphql(`
		fragment AttachmentListItem on Attachment {
			id
			type
			url
			fileName
			sizeInBytes
			createdAt
			thumbnail
		}
	`);

	let props: { attachment?: FragmentType<typeof AttachmentListItem> | null } = $props();
	let attachment = $derived(useFragment(AttachmentListItem, props.attachment));
	let Icon = $derived(attachment && ATTACHMENT_TYPE_TO_ICONS[attachment.type].icon);
</script>

{#if attachment}
	<a
		href={attachment.url}
		class="flex w-72 flex-col items-center gap-2 rounded-3xl bg-base-100 p-3"
	>
		{#if attachment.thumbnail}
			<img
				src={attachment.thumbnail}
				alt="{attachment.fileName} thumbnail"
				class="size-44 object-contain"
			/>
		{:else}
			<div class="flex size-44 items-center justify-center">
				<Icon class="size-12" />
			</div>
		{/if}
		<p class="text-center font-semibold">{attachment.fileName || "No name"}</p>
		<p>{attachment.sizeInBytes} | {formatInboxDate(attachment.createdAt)}</p>
	</a>
{/if}
