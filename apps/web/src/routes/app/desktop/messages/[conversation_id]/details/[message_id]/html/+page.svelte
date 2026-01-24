<script lang="ts">
	import { autoIframeHeight } from "$lib/actions/autoIframeHeight";

	import type { PageData } from "./$houdini";

	let props: { data: PageData } = $props();

	let MessageHTMLBodyQuery = $derived(props.data.MessageHTMLBodyQuery);
	let message = $derived(
		$MessageHTMLBodyQuery.data?.node?.__typename === "Message"
			? $MessageHTMLBodyQuery.data?.node
			: null
	);
</script>

{#if message?.bodyHTML}
	<div class="w-full bg-white p-4">
		<iframe
			title="email"
			sandbox="allow-same-origin"
			referrerpolicy="no-referrer"
			srcdoc={message.bodyHTML}
			class="w-full"
			use:autoIframeHeight
		></iframe>
	</div>
{/if}
