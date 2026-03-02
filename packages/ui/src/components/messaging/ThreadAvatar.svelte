<script lang="ts">
	import { graphql, useFragment, type FragmentType } from "@gebna/graphql-client";
	import UsersIcon from "@lucide/svelte/icons/users";
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
	let otherParticipant = $derived(thread.participants.filter((p) => !p.isSelf)[0]);
</script>

<div class={["flex items-center justify-center bg-base-300", props.class]}>
	<UsersIcon />
</div>
