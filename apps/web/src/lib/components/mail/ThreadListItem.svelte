<script lang="ts">
	import { resolve } from "$app/paths";

	import { formatInboxDate } from "$lib/date";
	import { graphql, useFragment, type FragmentType } from "$lib/graphql/generated";

	import Avatar from "./Avatar.svelte";

	const ThreadListItem = graphql(`
		fragment ThreadListItem on Thread {
			id
			from {
				id
				address
				avatar
			}
			title
			snippet
			lastMessageAt
		}
	`);

	let props: { thread: FragmentType<typeof ThreadListItem> } = $props();

	const thread = $derived(useFragment(ThreadListItem, props.thread));
</script>

<a
	href={resolve("/app/mail/thread/[thread_id]", { thread_id: thread.id })}
	class="flex w-full items-center gap-3 rounded-3xl p-3 hover:bg-base-100"
>
	<Avatar src={thread.from.avatar} alt="{thread.from.address} avatar" />
	<div class="flex flex-col gap-1">
		<div class="font-semibold">{thread.title}</div>
		<div class="line-clamp-1 text-sm">{thread.snippet}</div>
	</div>
	<div class="ml-auto text-sm">
		{formatInboxDate(thread.lastMessageAt)}
	</div>
</a>
