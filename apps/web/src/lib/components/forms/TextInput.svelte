<script lang="ts" generics="T extends Record<string, unknown>">
	import type { Snippet } from "svelte";
	import type { HTMLInputTypeAttribute } from "svelte/elements";
	import {
		formFieldProxy,
		type FormPathArrays,
		type FormPathLeaves,
		type SuperForm,
	} from "sveltekit-superforms";

	import InputFieldError from "./InputFieldError.svelte";
	import RemoveInputButton from "./RemoveInputButton.svelte";

	interface Props {
		superform: SuperForm<T>;
		field: FormPathLeaves<T>;
		label?: string;
		placeholder?: string;
		hint?: string;
		type?: HTMLInputTypeAttribute;
		join?: Snippet;
		remover?: {
			field: FormPathArrays<T>;
			index: number;
		};
		disabled?: boolean;
		prepend?: Snippet;
	}

	let {
		superform,
		field,
		label,
		placeholder,
		hint,
		type = "text",
		remover,
		join,
		disabled,
		prepend,
	}: Props = $props();

	const { value, errors, constraints } = formFieldProxy(superform, field);

	const isJoined = !!remover || !!join;
</script>

<div class="flex flex-col">
	<fieldset class="fieldset">
		{#if label}
			<legend class="fieldset-legend">{label}</legend>
		{/if}
		<div class={{ join: isJoined }}>
			<label class={["input w-full", { "input-error": !!$errors, "join-item": isJoined }]}>
				{@render prepend?.()}
				<input
					{type}
					class="grow"
					{placeholder}
					name={field}
					bind:value={$value}
					aria-invalid={!!$errors}
					{disabled}
					{...$constraints}
				/>
			</label>
			{#if join}
				{@render join()}
			{:else if remover}
				<RemoveInputButton
					{superform}
					field={remover.field}
					index={remover.index}
					class="join-item btn-secondary"
					{disabled}
				/>
			{/if}
		</div>
		{#if hint}
			<p class="label">{hint}</p>
		{/if}
	</fieldset>
	<InputFieldError errors={$errors} />
</div>
