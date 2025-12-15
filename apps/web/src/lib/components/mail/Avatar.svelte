<script lang="ts">
	let { src, alt }: { src: string; alt: string } = $props();
</script>

<div class="avatar">
	<div class="size-12 rounded-full">
		<img {src} {alt} />
	</div>
</div>
