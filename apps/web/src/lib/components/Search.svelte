<script lang="ts">
	import SearchIcon from "@lucide/svelte/icons/search";
	import XIcon from "@lucide/svelte/icons/x";
	import { getContextClient } from "@urql/svelte";
	import { resource } from "runed";

	import { resolve } from "$app/paths";

	import { buildURQLFetchOptions } from "$lib/graphql";
	import { graphql } from "$lib/graphql/generated";

	const SearchQuery = graphql(`
		query SearchQuery($input: SearchInput!) {
			search(input: $input) {
				messages {
					id
					threadId
					recievedAt
					subject
					snippet
					from {
						id
						name
					}
				}
			}
		}
	`);

	let queryVal = $state("");
	const urqlClient = getContextClient();

	const searchResource = resource(
		() => queryVal,
		async (query, prevQuery, { signal }) => {
			if (!query || query === "/" || query === prevQuery || query.length < 4) return;
			const response = await urqlClient
				.query(
					SearchQuery,
					{ input: { query } },
					{
						fetchOptions: buildURQLFetchOptions(signal),
					}
				)
				.toPromise();

			return response;
		},
		{
			debounce: 300,
			lazy: true,
		}
	);

	let dialog: HTMLDialogElement;
	let input: HTMLInputElement;

	function showAndFocus() {
		dialog.showModal();
		setTimeout(() => {
			input.value = "";
			input.focus();
		}, 50);
	}
</script>

<svelte:document
	onkeypress={(e) => {
		if (e.key === "/") {
			showAndFocus();
		}
	}}
/>

<!-- svelte-ignore a11y_interactive_supports_focus -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="input hover:cursor-text" role="button" onclick={showAndFocus}>
	<SearchIcon />
	<div class="grow">Search</div>
	<kbd class="kbd">/</kbd>
</div>
<dialog bind:this={dialog} class="modal">
	<div class="modal-box h-144 w-88 md:w-xl">
		<div class="flex flex-col gap-4">
			<div class="join">
				<input
					type="text"
					placeholder="Search..."
					class="input-bordered input input-lg join-item grow"
					bind:value={queryVal}
					bind:this={input}
				/>
				<form method="dialog">
					<button class="btn join-item btn-lg"><XIcon /></button>
				</form>
			</div>

			{#if searchResource.loading}
				<div>loading...</div>
			{:else if searchResource.error}
				<div>something went wrong!</div>
			{:else if searchResource.current}
				{@const results = searchResource.current.data?.search?.messages}
				{#each results as result (result.id)}
					<div class="flex flex-col gap-1 rounded-lg bg-base-300 p-4">
						<a
							data-sveltekit-reload
							href={resolve("/app/mail/thread/[thread_id]", { thread_id: result.threadId })}
							class="text-sm font-bold wrap-anywhere link-hover"
						>
							{result.subject}
						</a>
						<div class="text-xs">{result.snippet}</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
