<script lang="ts">
	import { graphql, useFragment, type FragmentType } from "@gebna/graphql-client";
	import type { ClassValue } from "svelte/elements";

	const EmailThreadAvatar = graphql(`
		fragment EmailThreadAvatar on EmailThread {
			id
			avatar
			title
			participants {
				id
				avatar
				isSelf
				name
				address
			}
		}
	`);

	interface Props {
		class: ClassValue;
		thread: FragmentType<typeof EmailThreadAvatar>;
	}

	let props: Props = $props();
	let thread = $derived(useFragment(EmailThreadAvatar, props.thread));
	let otherParticipants = $derived(thread.participants.filter((p) => !p.isSelf));
</script>

<img
	src={thread.avatar || otherParticipants[0].avatar}
	alt="thread {thread.title} avatar"
	class={["object-contain", props.class]}
/>
