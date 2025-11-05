<script lang="ts">
	import "../app.css";

	import { MenuIcon, SearchIcon } from "@lucide/svelte";

	import { resolve } from "$app/paths";

	import favicon from "$lib/assets/favicon.svg";

	import type { LayoutProps } from "./$types";

	let { children, data }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="navbar shadow-sm">
	<div class="navbar-start">
		<button class="btn btn-ghost"><SearchIcon /></button>
	</div>
	<div class="navbar-center">
		<a href={resolve("/")} class="btn text-xl btn-ghost">BAZAR</a>
	</div>
	<div class="navbar-end">
		<label for="my-drawer-1" class="drawer-button btn btn-ghost"><MenuIcon /></label>
		<div class="drawer w-0">
			<input id="my-drawer-1" type="checkbox" class="drawer-toggle" />
			<div class="drawer-side">
				<label for="my-drawer-1" aria-label="close sidebar" class="drawer-overlay"></label>
				<ul class="menu min-h-full w-80 bg-base-200 p-4">
					{#if data.viewer}
						<li>
							<form method="post" action={resolve("/auth/logout")}>
								<button type="submit">Logout</button>
							</form>
						</li>
					{:else}
						<li><a href={resolve("/auth/signup")}>Signup</a></li>
						<li><a href={resolve("/auth/login")}>Login</a></li>
					{/if}
				</ul>
			</div>
		</div>
	</div>
</div>

{@render children?.()}
