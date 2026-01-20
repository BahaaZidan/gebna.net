<script lang="ts">
	import UsersIcon from "@lucide/svelte/icons/users";
	import type { ClassValue } from "svelte/elements";

	import { fragment, graphql, type ConversationAvatar } from "$houdini";

	let props: { conversation: ConversationAvatar; viewerIdentityId?: string; class: ClassValue } =
		$props();
	let conversation = $derived(
		fragment(
			props.conversation,
			graphql(`
				fragment ConversationAvatar on Conversation {
					id
					kind
					participants {
						identity {
							id
							address
							kind
							name
							avatar
						}
					}
				}
			`)
		)
	);

	let otherParticipants = $derived(
		$conversation.participants.filter((p) => p.identity.id !== props.viewerIdentityId)
	);
</script>

{#if $conversation.kind === "PRIVATE"}
	<img
		src={otherParticipants[0].identity.avatar}
		alt="{otherParticipants[0].identity.name || otherParticipants[0].identity.address} avatar"
		class={["object-contain", props.class]}
	/>
{:else}
	<div class={["flex items-center justify-center bg-base-300", props.class]}>
		<UsersIcon />
	</div>
{/if}
