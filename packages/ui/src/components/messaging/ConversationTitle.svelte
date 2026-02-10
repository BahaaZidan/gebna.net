<script lang="ts">
	interface Props {
		viewerIdentityId?: string;
		conversation: {
			title: string | null;
			kind: "PRIVATE" | "GROUP";
			participants: {
				identity: {
					id: string;
					address: string;
					name: string | null;
					relations: {
						isContact: boolean;
						givenName?: string;
					}[];
				};
			}[];
		};
	}
	let { conversation, viewerIdentityId }: Props = $props();

	let otherParticipants = $derived(
		conversation.participants.filter((p) => p.identity.id !== viewerIdentityId)
	);
</script>

<span class="wrap-anywhere">
	{#if conversation.kind === "PRIVATE"}
		{#if otherParticipants[0].identity.relations[0].isContact}
			{otherParticipants[0].identity.relations[0].givenName ||
				otherParticipants[0].identity.name ||
				otherParticipants[0].identity.address}
		{:else}
			{otherParticipants[0].identity.name || otherParticipants[0].identity.address}
		{/if}
	{:else}
		{conversation.title ||
			otherParticipants.map((p) => p.identity.name || p.identity.address).join(", ")}
	{/if}
</span>
