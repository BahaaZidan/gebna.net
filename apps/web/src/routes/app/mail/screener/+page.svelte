<script lang="ts">
	import ArrowRightLeftIcon from "@lucide/svelte/icons/arrow-right-left";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
	import NewspaperIcon from "@lucide/svelte/icons/newspaper";
	import ThumbsDownIcon from "@lucide/svelte/icons/thumbs-down";
	import ThumbsUpIcon from "@lucide/svelte/icons/thumbs-up";
	import { getContextClient, queryStore } from "@urql/svelte";

	import { resolve } from "$app/paths";

	import { autoIframeHeight } from "$lib/actions/autoIframeHeight";
	import Container from "$lib/components/Container.svelte";
	import Navbar from "$lib/components/Navbar.svelte";
	import { graphql } from "$lib/graphql/generated";
	import { assignTargetMailbox } from "$lib/graphql/mutations";

	const urqlClient = getContextClient();
	const ScreenerPageQuery = graphql(`
		query ScreenerPageQuery {
			viewer {
				...NavbarFragment
				id
				screenerMailbox: mailbox(type: screener) {
					id
					type
					name
					assignedContactsCount
					contacts {
						edges {
							node {
								id
								address
								name
								avatar
								firstMessage {
									id
									bodyText
									bodyHTML
									subject
								}
							}
						}
					}
				}
			}
		}
	`);
	const screenerPageQuery = queryStore({
		client: urqlClient,
		query: ScreenerPageQuery,
	});
	const screenerMailbox = $derived($screenerPageQuery.data?.viewer?.screenerMailbox);
</script>

<Navbar viewer={$screenerPageQuery.data?.viewer}>
	{#snippet prepend()}
		<a href={resolve("/app/mail")} class="btn mr-2 btn-accent">
			<ChevronLeftIcon />
			Important
		</a>
	{/snippet}
</Navbar>
<Container>
	<div class="flex w-full justify-between">
		<a href={resolve("/app/mail")} class="btn btn-accent">Done</a>
	</div>
	<h1 class="text-5xl font-bold">The Screener</h1>
	<div class="text-lg">
		The threads below are from people trying to email you for the first time.
	</div>
	<div class="text-lg">You get to decide if you want to hear from them.</div>
	<div class="divider divider-start">Want to get emails from them?</div>
	{#each screenerMailbox?.contacts.edges as { node } (node.id)}
		{@const firstMessage = node.firstMessage!}
		<details class="collapse mb-2 border border-base-300 bg-base-100">
			<summary class="collapse-title">
				<div class="flex w-full items-center justify-between gap-2">
					<div class="ml-4 flex items-center gap-2">
						<div class="avatar">
							<div class="size-16 rounded-full">
								<img src={node.avatar} alt="{node.name} avatar" />
							</div>
						</div>
						<div class="flex flex-col">
							<div class="flex gap-2">
								<div class="font-bold whitespace-nowrap">{node.name}</div>
								<div class="line-clamp-1 wrap-anywhere text-accent-content">{node.address}</div>
							</div>
							<div>{firstMessage.subject}</div>
						</div>
					</div>
					<div class="flex gap-2">
						<div class="join">
							<button
								class="btn join-item btn-success"
								onclick={assignTargetMailbox(urqlClient, node.id, "important")}
							>
								<ThumbsUpIcon /> Yes
							</button>
							<button
								class="btn join-item p-2 btn-success"
								popovertarget="popover-{node.id}"
								style="anchor-name:--anchor-{node.id}"
							>
								<ChevronDownIcon />
							</button>
						</div>
						<button
							class="btn btn-warning"
							onclick={assignTargetMailbox(urqlClient, node.id, "trash")}
						>
							<ThumbsDownIcon /> No
						</button>
					</div>
				</div>
			</summary>
			<div class="collapse-content">
				{#if firstMessage.bodyHTML}
					<iframe
						title="iimak"
						sandbox="allow-same-origin"
						referrerpolicy="no-referrer"
						srcdoc={firstMessage.bodyHTML}
						class="w-full"
						use:autoIframeHeight
					></iframe>
				{/if}
			</div>
		</details>
		<ul
			class="menu dropdown w-52 rounded-box bg-success text-success-content shadow-sm"
			popover
			id="popover-{node.id}"
			style="position-anchor:--anchor-{node.id}"
		>
			<li>
				<button onclick={assignTargetMailbox(urqlClient, node.id, "news")}>
					<NewspaperIcon /> News
				</button>
			</li>
			<li>
				<button onclick={assignTargetMailbox(urqlClient, node.id, "transactional")}>
					<ArrowRightLeftIcon /> Transactional
				</button>
			</li>
		</ul>
	{/each}
</Container>
