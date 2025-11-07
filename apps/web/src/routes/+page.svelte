<script lang="ts">
	import { v } from "@gebna/validation";

	const schema = v.object({
		lolo: v.string(),
	});

	$effect(() => {
		console.log({ validation_result: v.safeParse(schema, { lolo: 12 }) });
	});
</script>

<h1>Welcome to SvelteKit</h1>
<p>
	Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a>
	to read the documentation
</p>
