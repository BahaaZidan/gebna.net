<script lang="ts">
	import { graphql, useFragment, type FragmentType } from "@gebna/graphql-client";

	const EmailThreadTitle = graphql(`
		fragment EmailThreadTitle on EmailThread {
			id
			title
			participants {
				id
				isSelf
				name
			}
		}
	`);
	interface Props {
		thread: FragmentType<typeof EmailThreadTitle>;
	}
	let props: Props = $props();
	let thread = $derived(useFragment(EmailThreadTitle, props.thread));

	let otherParticipants = $derived(thread.participants.filter((p) => !p.isSelf));
</script>

<span class="wrap-anywhere">
	{thread.title || otherParticipants.map((p) => p.name).join(", ")}
</span>
