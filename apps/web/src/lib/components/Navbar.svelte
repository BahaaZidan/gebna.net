<script lang="ts">
	import type { IconProps } from "@lucide/svelte";
	import BookOpenIcon from "@lucide/svelte/icons/book-open";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import ImagesIcon from "@lucide/svelte/icons/images";
	import LogOutIcon from "@lucide/svelte/icons/log-out";
	import PinIcon from "@lucide/svelte/icons/pin";
	import ReceiptTextIcon from "@lucide/svelte/icons/receipt-text";
	import ReplyAllIcon from "@lucide/svelte/icons/reply-all";
	import SearchIcon from "@lucide/svelte/icons/search";
	import StarIcon from "@lucide/svelte/icons/star";
	import TrashIcon from "@lucide/svelte/icons/trash-2";
	import { queryStore } from "@urql/svelte";
	import type { Component, Snippet } from "svelte";

	import { resolve } from "$app/paths";
	import type { Pathname } from "$app/types";

	import { deleteAccessToken } from "$lib/authentication";
	import { urqlClient } from "$lib/graphql";
	import { graphql } from "$lib/graphql/generated";

	import Search from "./Search.svelte";

	let { prepend }: { prepend?: Snippet } = $props();

	const NavbarQuery = graphql(`
		query NavbarQuery {
			viewer {
				id
				username
				name
				avatar
			}
		}
	`);

	const navbarQuery = queryStore({
		client: urqlClient,
		query: NavbarQuery,
	});

	const resolvePath = resolve as (route: Pathname) => string;
</script>

{#snippet navItem(label: string, route: Pathname, Icon: Component<IconProps, {}, "">)}
	<a
		href={resolvePath(route)}
		class="flex w-32 flex-col items-center gap-1 rounded-3xl bg-base-300 p-3"
	>
		<Icon class="size-6" />
		<span class="text-sm">{label}</span>
	</a>
{/snippet}

<div class="navbar bg-base-100 px-28 shadow-sm">
	<div class="navbar-start">
		{@render prepend?.()}
		<Search />
	</div>
	<div class="navbar-center">
		<button
			class="btn font-mono text-xl btn-ghost"
			popovertarget="navbar-center-popover"
			style="anchor-name:--navbar-center-anchor"
		>
			gebna <ChevronDownIcon class="mt-0.5 size-5" />
		</button>
		<div
			popover
			id="navbar-center-popover"
			style="position-anchor:--navbar-center-anchor"
			class="dropdown dropdown-center"
		>
			<div class="flex w-md flex-col gap-4 rounded-3xl bg-base-100 p-6">
				<div class="flex flex-wrap justify-center gap-2">
					{@render navItem("Important", "/app/mail", StarIcon)}
					{@render navItem("News", "/app/mail/news", BookOpenIcon)}
					{@render navItem("Transactional", "/app/mail/transactional", ReceiptTextIcon)}
					{@render navItem("Reply Later", "/app/mail/reply-later", ReplyAllIcon)}
					{@render navItem("Set Aside", "/app/mail/set-aside", PinIcon)}
					{@render navItem("All Files", "/app/mail/all-files", ImagesIcon)}
					{@render navItem("Trash", "/app/mail/trash", TrashIcon)}
				</div>
			</div>
		</div>
	</div>
	<div class="navbar-end">
		{#if $navbarQuery.data?.viewer?.username}
			{@const viewer = $navbarQuery.data.viewer}
			<div class="dropdown dropdown-center">
				<div tabindex="0" role="button" class="avatar hover:cursor-pointer">
					<div class="size-12 rounded-full">
						<img alt="User avatar" src={viewer.avatar} />
					</div>
				</div>
				<ul
					tabindex="-1"
					class="dropdown-content menu z-1 mt-3 w-52 menu-sm rounded-box bg-base-100 p-2 shadow"
				>
					<li>
						<button
							onclick={() => {
								deleteAccessToken();
								location.reload();
							}}
						>
							<LogOutIcon /> Logout
						</button>
					</li>
				</ul>
			</div>
		{/if}
	</div>
</div>
