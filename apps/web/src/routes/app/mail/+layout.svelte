<script lang="ts">
	import LogOutIcon from "@lucide/svelte/icons/log-out";
	import { queryStore, setContextClient } from "@urql/svelte";

	import { resolve } from "$app/paths";

	import { deleteAccessToken } from "$lib/authentication";
	import { urqlClient } from "$lib/graphql";
	import { graphql } from "$lib/graphql/generated";

	let { children } = $props();
	setContextClient(urqlClient);

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

<div class="navbar bg-base-100 shadow-sm">
	<div class="navbar-start">
		<div class="dropdown">
			<div tabindex="0" role="button" class="btn btn-circle btn-ghost">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h16M4 18h7"
					/>
				</svg>
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
	<div class="navbar-center">
		<a class="btn text-xl btn-ghost" href="/">gebna</a>
	</div>
	<div class="navbar-end">
		{#if $navbarQuery.fetching}
			<span class="loading loading-md loading-spinner"></span>
		{:else if $navbarQuery.error}
			<p>error</p>
		{:else if $navbarQuery.data?.viewer?.username}
			<button
				class="btn btn-circle btn-ghost"
				aria-label="Logout"
				onclick={() => {
					deleteAccessToken();
					location.reload();
				}}
			>
				<LogOutIcon />
			</button>
		{:else}{/if}
	</div>
</div>

{@render children()}
