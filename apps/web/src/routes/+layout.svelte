<script lang="ts">
	import "../app.css";

	import { setContextClient } from "@urql/svelte";

	import favicon from "$lib/assets/favicon.svg";
	import { urqlClient } from "$lib/graphql";

	let { children } = $props();
	setContextClient(urqlClient);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
