<script lang="ts">
	import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";

	import { resolve } from "$app/paths";
	import type { Pathname } from "$app/types";

	import { graphql, useFragment, type FragmentType } from "$lib/graphql/generated";
	import type { MailboxType } from "$lib/graphql/generated/graphql";

	const ThreadMailboxLink = graphql(`
		fragment ThreadMailboxLink on Thread {
			id
			mailbox {
				id
				type
				name
			}
		}
	`);

	let props: { thread?: FragmentType<typeof ThreadMailboxLink> | null } = $props();
	const mailbox = $derived(useFragment(ThreadMailboxLink, props.thread)?.mailbox);
	const mailboxTypeToPath: Record<MailboxType, Pathname> = {
		important: "/app/mail",
		news: "/app/mail/news",
		screener: "/app/mail/screener",
		transactional: "/app/mail/transactional",
		trash: "/app/mail/trash",
	};
</script>

{#if mailbox}
	<a href={mailboxTypeToPath[mailbox.type]} class="btn mr-2 btn-accent">
		<ChevronLeftIcon />
		{mailbox.name}
	</a>
{/if}
