<script lang="ts">
	import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";

	import type { Pathname } from "$app/types";
	import { fragment, graphql, type MailboxLink, type MailboxType$options } from "$houdini";

	let props: { mailbox?: MailboxLink | null } = $props();
	let mailbox = $derived(
		fragment(
			props.mailbox,
			graphql(`
				fragment MailboxLink on Mailbox {
					id
					type
					name
				}
			`)
		)
	);

	let mailboxTypeToPath: Record<MailboxType$options, Pathname> = {
		important: "/app/desktop/mail",
		news: "/app/desktop/mail/news",
		screener: "/app/desktop/mail/screener",
		transactional: "/app/desktop/mail/transactional",
		trash: "/app/desktop/mail/trash",
	};
</script>

{#if $mailbox}
	<a href={mailboxTypeToPath[$mailbox.type]} class="btn mr-2 btn-accent">
		<ChevronLeftIcon />
		{$mailbox.name}
	</a>
{/if}
