<script lang="ts">
	import { graphql, useFragment, type FragmentType } from "@gebna/graphql-client";

	const EmailConversationTitle = graphql(`
		fragment EmailConversationTitle on EmailConversation {
			id
			kind
			title
			participants {
				id
				isSelf
				name
			}
		}
	`);
	interface Props {
		conversation: FragmentType<typeof EmailConversationTitle>;
	}
	let props: Props = $props();
	let conversation = $derived(useFragment(EmailConversationTitle, props.conversation));

	let otherParticipants = $derived(conversation.participants.filter((p) => !p.isSelf));
</script>

<span class="wrap-anywhere">
	{#if conversation.kind === "PRIVATE"}
		{otherParticipants[0].name}
	{:else}
		{conversation.title || otherParticipants.map((p) => p.name).join(", ")}
	{/if}
</span>
