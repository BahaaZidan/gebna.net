<script lang="ts">
	import XIcon from "@lucide/svelte/icons/x";
	import type { Snippet } from "svelte";

	let props: { children: Snippet } = $props();
</script>

<dialog open class="modal">
	<div class="modal-box border p-0">
		<div class="flex justify-end">
			<button class="btn btn-ghost" onclick={() => history.back()}>
				<XIcon />
			</button>
		</div>
		<div class="px-6 pt-2 pb-6">
			{@render props.children()}
		</div>
	</div>
</dialog>
