<script lang="ts">
	import { graphql, useFragment, type FragmentType } from "@gebna/graphql-client";
	import type { ClassValue } from "svelte/elements";

	const EmailThreadAvatar = graphql(`
		fragment EmailThreadAvatar on EmailThread {
			id
			avatar
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
	src={otherParticipants[0].avatar}
	alt="{otherParticipants[0].name || otherParticipants[0].address} avatar"
	class={["object-contain", props.class]}
/>
