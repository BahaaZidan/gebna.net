<script lang="ts">
	import UsersIcon from "@lucide/svelte/icons/users";
	import type { ClassValue } from "svelte/elements";

	interface Props {
		class: ClassValue;
		viewerIdentityId?: string;
		conversation: {
			kind: "PRIVATE" | "GROUP";
			participants: {
				identity: {
					kind: "GEBNA_USER" | "EXTERNAL_EMAIL";
					id: string;
					address: string;
					name: string | null;
					inferredAvatar: string | null;
					avatarPlaceholder: string;
				};
			}[];
		};
	}

	let props: Props = $props();

	let otherParticipants = $derived(
		props.conversation.participants.filter((p) => p.identity.id !== props.viewerIdentityId)
	);
</script>

{#if props.conversation.kind === "PRIVATE"}
	<img
		src={otherParticipants[0].identity.inferredAvatar ||
			otherParticipants[0].identity.avatarPlaceholder}
		alt="{otherParticipants[0].identity.name || otherParticipants[0].identity.address} avatar"
		class={["object-contain", props.class]}
	/>
{:else}
	<div class={["flex items-center justify-center bg-base-300", props.class]}>
		<UsersIcon />
	</div>
{/if}
