<script lang="ts">
	import AsteriskIcon from "@lucide/svelte/icons/asterisk";
	import { getContextClient, queryStore } from "@urql/svelte";

	import Container from "$lib/components/Container.svelte";
	import Navbar from "$lib/components/Navbar.svelte";
	import { formatInboxDate } from "$lib/date";
	import { graphql } from "$lib/graphql/generated";
	import type { AttachmentType } from "$lib/graphql/generated/graphql";
	import { ATTACHMENT_TYPES } from "$lib/mail";

	const AllFilesPageQuery = graphql(`
		query AllFilesPageQuery($first: Int = 10, $after: String, $filter: AttachmentsFilter = {}) {
			viewer {
				...NavbarFragment
				id
				attachments(first: $first, after: $after, filter: $filter) {
					pageInfo {
						endCursor
						hasNextPage
					}
					edges {
						cursor
						node {
							id
							fileName
							url
							mimeType
							sizeInBytes
							createdAt
						}
					}
				}
			}
		}
	`);
	let attachmentType: AttachmentType | null = $state(null);
	let allFilesPageQuery = $derived(
		queryStore({
			client: getContextClient(),
			query: AllFilesPageQuery,
			variables: {
				filter: {
					attachmentType,
				},
			},
		})
	);
	const attachments = $derived(
		$allFilesPageQuery.data?.viewer?.attachments.edges.map((e) => e.node)
	);
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

		<button class="btn p-0 text-lg btn-link">everyone</button>
	</h3>
	<div class="mt-3 flex w-full flex-wrap gap-4">
		{#each attachments as attachment (attachment.id)}
			<div class="flex w-72 flex-col items-center gap-2 rounded-3xl bg-base-100 p-3">
				<p class="text-center font-semibold">{attachment.fileName || "No name"}</p>
				<p>{attachment.sizeInBytes} | {formatInboxDate(attachment.createdAt)}</p>
			</div>
		{/each}
	</div>
</Container>
