<script lang="ts">
	import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
	import { superForm } from "sveltekit-superforms";

	import { resolve } from "$app/paths";

	import TextInput from "$lib/components/TextInput.svelte";

	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const superform = superForm(data.form);
	const { enhance, message } = superform;
</script>

<div class="flex h-[calc(100vh-4rem)] w-screen flex-col items-center justify-center gap-4">
	<div role="alert" class={["alert alert-error", { invisible: !$message }]}>
		<TriangleAlertIcon />
		<span>{$message}</span>
	</div>

	<div class="flex flex-col items-center">
		<div>Welcome Back!</div>
		<div>Login to your account</div>
	</div>

	<div class="flex w-full justify-center">
		<form method="post" use:enhance class="flex w-72 flex-col items-center gap-3">
			<TextInput {superform} field="handle" label="Handle" />
			<TextInput {superform} field="password" type="password" label="Password" />

			<button class="btn btn-block btn-primary" type="submit">Login</button>
		</form>
	</div>
	<div>
		Don't have an account? <a href={resolve("/auth/signup")} class="link link-primary">Signup</a>
	</div>
</div>
