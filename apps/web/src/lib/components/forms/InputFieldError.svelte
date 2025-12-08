<script lang="ts">
	let { errors = [] }: { errors?: string[] } = $props();
</script>

<div class="mt-1 flex flex-col gap-0.5">
	{#each errors as error (error)}
		<div class="text-error text-xs">
			{error}
		</div>
	{/each}
</div>
