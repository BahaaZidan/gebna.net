<script lang="ts">
	import { v } from "@gebna/validation";

	const schema = v.object({
		lolo: v.string(),
	});

	$effect(() => {
		console.log({ validation_result: v.safeParse(schema, { lolo: 12 }) });
	});
</script>

<h1>PRODUCT PAGE</h1>
