<script lang="ts">
	import type { Snippet } from "svelte";

	let { children }: { children: Snippet } = $props();
</script>

<div class="mx-auto my-10 flex w-full max-w-6xl flex-col items-center rounded-2xl p-5 shadow-lg">
	{@render children()}
</div>
