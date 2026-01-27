<script lang="ts">
	import { type IconProps } from "@lucide/svelte";
	import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import SearchIcon from "@lucide/svelte/icons/search";
	import SendHorizontalIcon from "@lucide/svelte/icons/send-horizontal";
	import { type Component, type Snippet } from "svelte";

	import { graphql } from "$houdini";

	import ConversationAvatar from "$lib/components/mail/ConversationAvatar.svelte";
	import ConversationTitle from "$lib/components/mail/ConversationTitle.svelte";
	import MessageBubble from "$lib/components/mail/MessageBubble.svelte";

	import type { LayoutData } from "./$houdini";

	let props: { children: Snippet; data: LayoutData } = $props();

	let ConversationDetailsQuery = $derived(props.data.ConversationDetailsQuery);
	let conversation = $derived(
		$ConversationDetailsQuery.data?.node?.__typename === "Conversation"
			? $ConversationDetailsQuery.data?.node
			: null
	);

	let MainViewerQuery = $derived(props.data.MainViewerQuery);
	let viewer = $derived($MainViewerQuery.data?.viewer);

	let MarkConversationReadMutation = graphql(`
		mutation MarkConversationReadMutation($id: ID!) {
			markConversationRead(id: $id) {
				id
				viewerState {
					mailbox
					unreadCount
				}
			}
		}
	`);
	$effect(() => {
		if (!conversation) return;
		let timeout: NodeJS.Timeout | null;
		if (conversation.viewerState.unreadCount > 0) {
			timeout = setTimeout(() => {
				MarkConversationReadMutation.mutate({ id: conversation.id });
			}, 2000);
		}
		return () => {
			if (timeout) clearTimeout(timeout);
		};
	});

	let SendMessageMutation = graphql(`
		mutation SendMessageMutation($input: SendMessageInput!) {
			sendMessage(input: $input) {
				...Conversation_Messages_insert @prepend
				id
				createdAt
				bodyMD
			}
		}
	`);
	let messageVal = $state("");
	async function sendMessage() {
		if (!conversation) return;
		await SendMessageMutation.mutate({
			input: {
				bodyMD: messageVal,
				conversationId: conversation.id,
			},
		});
		messageVal = "";
	}

	let MessageAddedSubscription = graphql(`
		subscription MessageAddedSubscription($conversationId: ID!) {
			messageAdded(conversationId: $conversationId) {
				...Conversation_Messages_insert @prepend
				id
				...MessageBubble
			}
		}
	`);
	$effect(() => {
		if (!conversation) return;
		MessageAddedSubscription.listen({ conversationId: conversation.id });

		return () => {
			MessageAddedSubscription.unlisten();
		};
	});
</script>

{#if conversation && viewer}
	<div class="flex h-full min-h-0 flex-col">
		<div class="flex shrink-0 justify-between border-b p-3">
			<div class="flex items-center gap-2">
				<ConversationAvatar {conversation} class="size-10 min-h-10 min-w-10" />
				<div><ConversationTitle {conversation} /></div>
			</div>
			<div class="flex">
				{@render iconButton({ label: "Search", Icon: SearchIcon })}
				{@render iconButton({ label: "Menu", Icon: EllipsisVerticalIcon })}
			</div>
		</div>
		<div class="flex min-h-0 flex-1 flex-col-reverse gap-4 overflow-y-auto p-3">
			{#each conversation.messages.edges as { node } (node.id)}
				<MessageBubble message={node} conversationId={conversation.id} />
			{/each}
		</div>
		<div class="flex shrink-0 flex-col gap-2 border-t p-3">
			<div class="flex w-full items-end gap-2">
				<button class="btn btn-ghost">
					<PlusIcon />
				</button>
				<textarea
					class="textarea-bordered textarea grow resize-none"
					rows="1"
					placeholder="Message"
					bind:value={messageVal}
					disabled={$SendMessageMutation.fetching}
				></textarea>
				<button
					disabled={$SendMessageMutation.fetching}
					onclick={sendMessage}
					class="btn btn-ghost"
				>
					<SendHorizontalIcon />
				</button>
			</div>
		</div>
	</div>

	{@render props.children()}
{/if}

{#snippet iconButton({ label, Icon }: { label: string; Icon: Component<IconProps> })}
	<div class="tooltip tooltip-bottom" data-tip={label}>
		<button class="btn p-2 btn-ghost">
			<Icon />
		</button>
	</div>
{/snippet}
