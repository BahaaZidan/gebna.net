<script lang="ts">
	import type { FieldElementProps } from "@formisch/svelte";

	interface Props extends FieldElementProps {
		class?: string;
		type: "text" | "email" | "tel" | "password" | "url" | "number" | "date";
		label?: string;
		placeholder?: string;
		required?: boolean;
		input: string | number | undefined;
		errors: [string, ...string[]] | null;
	}

	let { label, name, required, input, errors, ...fieldProps }: Props = $props();

	let value: string | number | undefined = $state();

	$effect(() => {
		if (!Number.isNaN(input)) {
			value = input;
		}
	});
</script>

<fieldset class="fieldset">
	<legend class="fieldset-legend">
		{label}
		{#if required}
			<span class="text-error">*</span>
		{/if}
	</legend>
	<input
		{...fieldProps}
		id={name}
		{name}
		class={[
			"input w-full",
			{
				"input-error": errors,
			},
		]}
		{value}
		{required}
		aria-invalid={!!errors}
		aria-errormessage={`${name}-error`}
	/>
	{#if errors}
		<p class="label text-error">{errors[0]}</p>
	{/if}
</fieldset>
