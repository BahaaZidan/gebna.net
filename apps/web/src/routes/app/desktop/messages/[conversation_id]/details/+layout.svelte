<script lang="ts">
	import XIcon from "@lucide/svelte/icons/x";
	import type { Snippet } from "svelte";

	import { resolve } from "$app/paths";

	import type { LayoutData } from "./$houdini";

	let props: { children: Snippet; data: LayoutData } = $props();
	let ConversationDetailsQuery = $derived(props.data.ConversationDetailsQuery);
	let conversation = $derived(
		$ConversationDetailsQuery.data?.node?.__typename === "Conversation"
			? $ConversationDetailsQuery.data?.node
			: null
	);
</script>

{#if conversation}
	<dialog open class="modal">
		<div class="modal-box border p-0">
			<div class="flex justify-end">
				{#if history.length}
					<button class="btn btn-ghost" onclick={() => history.back()}>
						<XIcon />
					</button>
				{:else}
					<a
						class="btn btn-ghost"
						href={resolve("/app/desktop/messages/[conversation_id]", {
							conversation_id: conversation.id,
						})}
					>
						<XIcon />
					</a>
				{/if}
			</div>
			<div class="px-6 pt-2 pb-6">
				{@render props.children()}
			</div>
		</div>
	</dialog>
{/if}
