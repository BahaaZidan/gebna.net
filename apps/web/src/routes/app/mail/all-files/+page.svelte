<script lang="ts">
	import AsteriskIcon from "@lucide/svelte/icons/asterisk";
	import UsersRoundIcon from "@lucide/svelte/icons/users-round";
	import { getContextClient, queryStore } from "@urql/svelte";

	import Container from "$lib/components/Container.svelte";
	import AttachmentListItem from "$lib/components/mail/AttachmentListItem.svelte";
	import Navbar from "$lib/components/Navbar.svelte";
	import { graphql } from "$lib/graphql/generated";
	import type { AttachmentType } from "$lib/graphql/generated/graphql";
	import { ATTACHMENT_TYPES } from "$lib/mail";

	const AllFilesPageQuery = graphql(`
		query AllFilesPageQuery(
			$firstAttachments: Int = 10
			$afterAttachment: String
			$filterAttachments: AttachmentsFilter = {}
			$firstContacts: Int = 10
			$afterContact: String
		) {
			viewer {
				...NavbarFragment
				id
				attachments(first: $firstAttachments, after: $afterAttachment, filter: $filterAttachments) {
					pageInfo {
						endCursor
						hasNextPage
					}
					edges {
						cursor
						node {
							...AttachmentListItem
							id
						}
					}
				}
				contacts(first: $firstContacts, after: $afterContact) {
					pageInfo {
						endCursor
						hasNextPage
					}
					edges {
						cursor
						node {
							id
							name
							address
							avatar
						}
					}
				}
			}
		}
	`);
	let attachmentType: AttachmentType | null = $state(null);
	let contactAddress: string | null = $state(null);
	let allFilesPageQuery = $derived(
		queryStore({
			client: getContextClient(),
			query: AllFilesPageQuery,
			variables: {
				filterAttachments: {
					attachmentType,
					contactAddress,
				},
			},
		})
	);
	const attachments = $derived(
		$allFilesPageQuery.data?.viewer?.attachments.edges.map((e) => e.node)
	);
	const contacts = $derived($allFilesPageQuery.data?.viewer?.contacts.edges.map((e) => e.node));
</script>

<Navbar viewer={$allFilesPageQuery.data?.viewer} />
<Container>
	<h1 class="divider text-5xl font-semibold">All Files</h1>
	<h3 class="flex items-baseline gap-1">
		<select class="select" bind:value={attachmentType}>
			<option value={null}><AsteriskIcon /> All Files</option>
			{#each ATTACHMENT_TYPES as at (at.type)}
				<option value={at.type}><at.icon /> {at.name}</option>
			{/each}
		</select>

		<span class="text-lg">sent by</span>

		<select class="select" bind:value={contactAddress}>
			<option value={null}><UsersRoundIcon /> everyone</option>
			{#each contacts as c (c.id)}
				<option value={c.address}>{c.name}</option>
			{/each}
		</select>
	</h3>
	<div class="mt-3 flex w-full flex-wrap justify-center gap-4">
		{#each attachments as attachment (attachment.id)}
			<AttachmentListItem {attachment} />
		{/each}
	</div>
</Container>
