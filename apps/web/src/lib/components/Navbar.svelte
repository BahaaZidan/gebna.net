<script lang="ts">
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import LogOutIcon from "@lucide/svelte/icons/log-out";
	import SearchIcon from "@lucide/svelte/icons/search";
	import { queryStore } from "@urql/svelte";
	import type { Snippet } from "svelte";

	import { deleteAccessToken } from "$lib/authentication";
	import { urqlClient } from "$lib/graphql";
	import { graphql } from "$lib/graphql/generated";

	let { prepend }: { prepend?: Snippet } = $props();

	const NavbarQuery = graphql(`
		query NavbarQuery {
			viewer {
				id
				username
			}
		}
	`);

	const navbarQuery = queryStore({
		client: urqlClient,
		query: NavbarQuery,
	});
</script>

<div class="navbar bg-base-100 px-28 shadow-sm">
	<div class="navbar-start">
		{@render prepend?.()}
		<label class="input">
			<SearchIcon />
			<input type="text" class="grow" placeholder="Search" />
		</label>
	</div>
	<div class="navbar-center">
		<div class="dropdown">
			<div tabindex="0" role="button" class="btn gap-0 font-mono text-xl btn-ghost">
				gebna <ChevronDownIcon class="mt-0.5 size-5" />
			</div>
			<ul
				tabindex="-1"
				class="dropdown-content menu z-1 mt-3 w-52 menu-sm rounded-box bg-base-100 p-2 shadow"
			>
				<li><a href="/">Homepage</a></li>
				<li><a href="/">Portfolio</a></li>
				<li><a href="/">About</a></li>
			</ul>
		</div>
	</div>
	<div class="navbar-end">
		{#if $navbarQuery.data?.viewer?.username}
			<div class="dropdown dropdown-end">
				<div tabindex="0" role="button" class="btn avatar btn-circle btn-ghost">
					<div class="w-10 rounded-full">
						<img
							alt="Tailwind CSS Navbar component"
							src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"
						/>
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
