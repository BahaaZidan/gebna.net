<script lang="ts">
	import { fragment, graphql, type ConversationTitle } from "$houdini";

	import { getViewer } from "$lib/graphql";

	let props: { conversation: ConversationTitle } = $props();
	let conversation = $derived(
		fragment(
			props.conversation,
			graphql(`
				fragment ConversationTitle on Conversation {
					id
					kind
					title
					participants {
						identity {
							id
							address
							kind
							name
							avatar
							relationshipToViewer {
								id
								isContact
								displayName
								avatarUrl
							}
						}
					}
				}
			`)
		)
	);

	let viewer = getViewer();
	let otherParticipants = $derived(
		$conversation.participants.filter((p) => p.identity.id !== viewer?.identity.id)
	);
</script>

<span class="wrap-anywhere">
	{#if $conversation.kind === "PRIVATE"}
		{#if otherParticipants[0].identity.relationshipToViewer?.isContact}
			{otherParticipants[0].identity.relationshipToViewer.displayName ||
				otherParticipants[0].identity.name ||
				otherParticipants[0].identity.address}
		{:else}
			{otherParticipants[0].identity.name || otherParticipants[0].identity.address}
		{/if}
	{:else}
		{$conversation.title ||
			otherParticipants.map((p) => p.identity.name || p.identity.address).join(", ")}
	{/if}
</span>
