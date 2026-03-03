<script lang="ts">
	import { graphql, useFragment, type FragmentType } from "@gebna/graphql-client";

	import { autoIframeHeight } from "../../actions";
	import { formatInboxDate } from "../../utils/format";

	const EmailMessageBubble = graphql(`
		fragment EmailMessageBubble on EmailMessage {
			id
			html
			plaintext
			createdAt
			from {
				id
				isSelf
				name
				avatar
				address
			}
		}
	`);

	let props: { message: FragmentType<typeof EmailMessageBubble> } = $props();
	let message = $derived(useFragment(EmailMessageBubble, props.message));
	let sender = $derived(message.from);
</script>

<div class="flex w-full items-start gap-4">
	<div class="avatar">
		<div class="w-12">
			<img alt="{sender.name || sender.address} avatar" src={sender.avatar} />
		</div>
	</div>
	<div class="flex w-full flex-col gap-2">
		<div class="flex items-baseline gap-1">
			<div class="font-bold text-black">{sender.name || sender.address}</div>
			<time class="text-xs text-gray-900">{formatInboxDate(message.createdAt)}</time>
		</div>
		{#if message.plaintext}
			<div>
				<pre class="text-black">{message.plaintext}</pre>
			</div>
		{:else if message.html}
			<div class="w-full">
				<iframe
					title="email"
					sandbox="allow-same-origin"
					referrerpolicy="no-referrer"
					srcdoc={message.html}
					class="w-full"
					use:autoIframeHeight
				></iframe>
			</div>
		{/if}
	</div>
</div>
