<script lang="ts">
	let count = $state(0);

	function handleClick() {
		count += 1;
	}
</script>

<button class="btn text-2xl" onclick={handleClick}>
	clickssddddd: {count}
</button>
