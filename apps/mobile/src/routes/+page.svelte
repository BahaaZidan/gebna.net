<script lang="ts">
	import { getViewer } from "@gebna/functions";
	import { MyCounterButton } from "@gebna/ui";

	const viewer = await getViewer();

	$effect(() => {
		console.log({ viewer });
	});
</script>

<h1 class="text-3xl">Mobile</h1>
<MyCounterButton />
<p>
	Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a>
	to read the documentation
</p>
