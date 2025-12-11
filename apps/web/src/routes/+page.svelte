<script lang="ts">
	import LogInIcon from "@lucide/svelte/icons/log-in";

	import { resolve } from "$app/paths";
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
		<a href={resolve("/auth/login")} class="btn btn-circle btn-ghost" aria-label="Login">
			<LogInIcon />
		</a>
	</div>
</div>

<h1>PRODUCT PAGE</h1>
