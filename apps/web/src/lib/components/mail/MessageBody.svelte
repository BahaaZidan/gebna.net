<script lang="ts">
	import { autoIframeHeight } from "$lib/actions/autoIframeHeight";
	import { graphql, useFragment, type FragmentType } from "$lib/graphql/generated";

	const MessageBody = graphql(`
		fragment MessageBody on Message {
			id
			bodyHTML
		}
	`);

	let props: { message?: FragmentType<typeof MessageBody> | null } = $props();
	const message = $derived(useFragment(MessageBody, props.message));
</script>

{#if message?.bodyHTML}
	<iframe
		title="email"
		sandbox="allow-same-origin"
		referrerpolicy="no-referrer"
		srcdoc={message.bodyHTML}
		class="w-full rounded-xl"
		use:autoIframeHeight
	></iframe>
{/if}
