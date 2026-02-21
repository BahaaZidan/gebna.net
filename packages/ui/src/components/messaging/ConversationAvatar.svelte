<script lang="ts">
	import { graphql, useFragment, type FragmentType } from "@gebna/graphql-client";
	import UsersIcon from "@lucide/svelte/icons/users";
	import type { ClassValue } from "svelte/elements";

	const EmailConversationAvatar = graphql(`
		fragment EmailConversationAvatar on EmailConversation {
			id
			kind
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
		conversation: FragmentType<typeof EmailConversationAvatar>;
	}

	let props: Props = $props();
	let conversation = $derived(useFragment(EmailConversationAvatar, props.conversation));
	let otherParticipant = $derived(conversation.participants.filter((p) => !p.isSelf)[0]);
</script>

{#if conversation.kind === "PRIVATE"}
	<img
		src={otherParticipant.avatar}
		alt="{otherParticipant.name || otherParticipant.address} avatar"
		class={["object-contain", props.class]}
	/>
{:else}
	<div class={["flex items-center justify-center bg-base-300", props.class]}>
		<UsersIcon />
	</div>
{/if}
