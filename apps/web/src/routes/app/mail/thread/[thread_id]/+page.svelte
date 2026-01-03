<script lang="ts">
	import { getContextClient, mutationStore, queryStore } from "@urql/svelte";

	import { resolve } from "$app/paths";
	import { page } from "$app/state";

	import Container from "$lib/components/Container.svelte";
	import AttachmentListItem from "$lib/components/mail/AttachmentListItem.svelte";
	import Avatar from "$lib/components/mail/Avatar.svelte";
	import MailboxLink from "$lib/components/mail/MailboxLink.svelte";
	import MessageBody from "$lib/components/mail/MessageBody.svelte";
	import Navbar from "$lib/components/Navbar.svelte";
	import { formatInboxDate } from "$lib/format";
	import { graphql } from "$lib/graphql/generated";

	const ThreadDetails = graphql(`
		query ThreadDetails($id: ID!) {
			viewer {
				...NavbarFragment
			}
			node(id: $id) {
				__typename
				... on Thread {
					id
					from {
						id
						address
						name
						avatar
					}
					unseenMessagesCount
					title
					lastMessageAt
					messages {
						...MessageBody
						id
						bodyHTML
						recievedAt
						from {
							id
							address
							name
							avatar
						}
						unseen
						snippet
						bodyText
						subject
						to
						cc
						replyTo
						attachments {
							id
							...AttachmentListItem
						}
					}
					mailbox {
						id
						...MailboxLink
					}
				}
			}
		}
	`);

	const urqlClient = getContextClient();
	const threadDetailsQuery = queryStore({
		client: urqlClient,
		query: ThreadDetails,
		variables: {
			id: page.params.thread_id!,
		},
	});
	const thread = $derived(
		$threadDetailsQuery.data?.node?.__typename === "Thread" ? $threadDetailsQuery.data.node : null
	);

	const MarkThreadSeenMutation = graphql(`
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
	const markThreadSeen = () => {
		mutationStore({
			client: urqlClient,
			query: MarkThreadSeenMutation,
			variables: { id: page.params.thread_id! },
		});
	};

	const EditThreadMutation = graphql(`
		mutation EditThreadMutation($input: EditThreadInput!) {
			editThread(input: $input) {
				id
				title
			}
		}
	`);
	const editThreadTitle = (title?: string | null) => {
		if (!title) return;
		mutationStore({
			client: urqlClient,
			query: EditThreadMutation,
			variables: { input: { id: page.params.thread_id!, title } },
		});
	};

	$effect(() => {
		if (!thread) return;
		let timeout: NodeJS.Timeout | null;
		if (thread.unseenMessagesCount > 0) {
			timeout = setTimeout(() => markThreadSeen(), 2000);
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
			onclick={() => {
				if (!thread.title) return;
				let newTitle = prompt("Edit Thread", thread.title);
				editThreadTitle(newTitle);
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
