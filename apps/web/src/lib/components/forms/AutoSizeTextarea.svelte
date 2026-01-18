<script lang="ts">
	import { TextareaAutosize } from 'runed';
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	type Props = {
		value?: string;
	} & Omit<HTMLTextareaAttributes, 'value'>;

	let { value = $bindable(''), ...rest }: Props = $props();

	let element = $state<HTMLTextAreaElement>(null!);

	new TextareaAutosize({
		element: () => element,
		input: () => value,
		styleProp: 'minHeight',
	});
</script>

<textarea {...rest} bind:this={element} bind:value></textarea>
