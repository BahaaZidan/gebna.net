<script lang="ts">
	import { resolve } from "$app/paths";
	import { fragment, graphql, type ThreadListItem } from "$houdini";

	import { formatInboxDate } from "$lib/format";

	import Avatar from "./Avatar.svelte";

	let props: { thread: ThreadListItem } = $props();

	let thread = $derived(
		fragment(
			props.thread,
			graphql(`
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
			`)
		)
	);
</script>

<a
	href={resolve("/app/mail/thread/[thread_id]", { thread_id: $thread.id })}
	class="flex w-full items-center gap-3 p-3 hover:bg-base-100"
>
	<Avatar src={$thread.from.avatar} alt="{$thread.from.address} avatar" />
	<div class="flex flex-col gap-1">
		<div class="font-semibold">{$thread.title}</div>
		<div class="line-clamp-1 text-sm">{$thread.snippet}</div>
	</div>
	<div class="ml-auto text-sm">
		{formatInboxDate($thread.lastMessageAt)}
	</div>
</a>
