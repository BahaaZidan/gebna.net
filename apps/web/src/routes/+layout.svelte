<script lang="ts">
	import "../app.css";
	import "@fontsource/inter/200";
	import "@fontsource/inter/300";
	import "@fontsource/inter/400";
	import "@fontsource/inter/500";
	import "@fontsource/inter/600";
	import "@fontsource/inter/700";
	import "@fontsource/inter/800";

	import favicon from "$lib/assets/favicon.svg";

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
