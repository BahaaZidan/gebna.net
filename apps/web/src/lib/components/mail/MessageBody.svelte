<script lang="ts">
	import { fragment, graphql, type MessageBody } from "$houdini";

	import { autoIframeHeight } from "$lib/actions/autoIframeHeight";

	let props: { message?: MessageBody | null } = $props();
	let message = $derived(
		fragment(
			props.message,
			graphql(`
				fragment MessageBody on Message {
					id
					bodyHTML
				}
			`)
		)
	);
</script>

{#if $message?.bodyHTML}
	<div class="w-full rounded-2xl bg-base-content p-4">
		<iframe
			title="email"
			sandbox="allow-same-origin"
			referrerpolicy="no-referrer"
			srcdoc={$message.bodyHTML}
			class="w-full"
			use:autoIframeHeight
		></iframe>
	</div>
{/if}
