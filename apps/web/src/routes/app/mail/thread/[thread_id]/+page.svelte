<script lang="ts">
	import { resolve } from "$app/paths";
	import { graphql } from "$houdini";

	import Container from "$lib/components/Container.svelte";
	import AttachmentListItem from "$lib/components/mail/AttachmentListItem.svelte";
	import Avatar from "$lib/components/mail/Avatar.svelte";
	import MailboxLink from "$lib/components/mail/MailboxLink.svelte";
	import MessageBody from "$lib/components/mail/MessageBody.svelte";
	import Navbar from "$lib/components/Navbar.svelte";
	import { formatInboxDate } from "$lib/format";

	import type { PageData } from "./$houdini";

	let props: { data: PageData } = $props();

	let threadDetailsQuery = $derived(props.data.ThreadDetails);
	let thread = $derived(
		$threadDetailsQuery.data?.node?.__typename === "Thread" ? $threadDetailsQuery.data.node : null
	);

	let MarkThreadSeenMutation = graphql(`
		mutation MarkThreadSeen($id: ID!) {
			markThreadSeen(id: $id) {
				id
				unseenMessagesCount
				messages {
					id
					unseen
				}
			}
		}
	`);

	let EditThreadMutation = graphql(`
		mutation EditThreadMutation($input: EditThreadInput!) {
			editThread(input: $input) {
				id
				title
			}
		}
	`);

	$effect(() => {
		if (!thread) return;
		let timeout: NodeJS.Timeout | null;
		if (thread.unseenMessagesCount > 0) {
			timeout = setTimeout(() => {
				MarkThreadSeenMutation.mutate({
					id: thread.id,
				});
			}, 2000);
		}
		return () => {
			if (timeout) clearTimeout(timeout);
		};
	});
</script>

<Navbar viewer={$threadDetailsQuery.data?.viewer}>
	{#snippet prepend()}
		<MailboxLink mailbox={thread?.mailbox} />
	{/snippet}
</Navbar>
<Container>
	{#if thread}
		<button
			class="mb-2 text-4xl font-semibold hover:cursor-pointer"
			onclick={async () => {
				if (!thread.title) return;
				let newTitle = prompt("Edit Thread", thread.title);
				if (!newTitle || newTitle === thread.title) return;
				await EditThreadMutation.mutate({
					input: {
						id: thread.id,
						title: newTitle,
					},
				});
			}}
		>
			{thread.title}
		</button>
		{#each thread.messages as message (message.id)}
			<div class="flex w-full gap-2 p-4">
				<Avatar src={message.from.avatar} alt={message.from.name} />
				<div class="flex w-full flex-col gap-3">
					<div class="flex items-center gap-1">
						<a
							href={resolve("/app/mail/contacts/[contact_id]", { contact_id: message.from.id })}
							class="font-semibold"
						>
							{message.from.name}
						</a>
						<div class="text-sm">{message.from.address}</div>
						<div class="ml-auto">{formatInboxDate(message.recievedAt)}</div>
					</div>
					<div>
						<MessageBody {message} />
					</div>
					{#if message.attachments.length}
						<h4 class="font-bold">Attachments</h4>
						<div class="flex flex-wrap gap-3">
							{#each message.attachments as attachment (attachment.id)}
								<AttachmentListItem {attachment} size="sm" />
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/each}
	{/if}
</Container>
