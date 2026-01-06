<script lang="ts">
	import { fragment, graphql, type AttachmentListItem } from "$houdini";

	import { formatInboxDate, formatSizeInBytes } from "$lib/format";
	import { ATTACHMENT_TYPE_TO_ICONS } from "$lib/mail";

	type ComponentScaling = "md" | "sm";
	let props: {
		attachment?: AttachmentListItem | null;
		size?: ComponentScaling;
	} = $props();
	let attachment = $derived(
		fragment(
			props.attachment,
			graphql(`
				fragment AttachmentListItem on Attachment {
					id
					type
					url
					fileName
					sizeInBytes
					createdAt
					thumbnail
				}
			`)
		)
	);
	let Icon = $derived($attachment && ATTACHMENT_TYPE_TO_ICONS[$attachment.type].icon);
	let size = $derived(props.size || "md");
</script>

{#if $attachment}
	<a
		href={$attachment.url}
		class={[
			"flex flex-col items-center gap-2 rounded-3xl bg-base-100 p-3",
			size === "sm" ? "w-52" : "w-72",
		]}
	>
		{#if $attachment.thumbnail}
			<img
				src={$attachment.thumbnail}
				alt="{$attachment.fileName} thumbnail"
				class={[" object-contain", size === "sm" ? "size-28" : "size-44"]}
			/>
		{:else}
			<div class={["flex  items-center justify-center", size === "sm" ? "size-28" : "size-44"]}>
				<Icon class={[size === "sm" ? "size-8" : "size-12"]} />
			</div>
		{/if}
		<p class={["text-center font-semibold wrap-anywhere", size === "sm" ? "text-sm" : ""]}>
			{$attachment.fileName || "No name"}
		</p>
		<p class={["mt-auto text-gray-400", size === "sm" ? "text-xs" : "text-sm"]}>
			{formatSizeInBytes($attachment.sizeInBytes)} - {formatInboxDate($attachment.createdAt)}
		</p>
	</a>
{/if}
