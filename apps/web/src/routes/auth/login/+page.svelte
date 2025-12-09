<script lang="ts">
	import { isSessionCreatedErrorResponse, isSessionCreatedSuccessResponse } from "@gebna/types";
	import { loginSchema } from "@gebna/validation/auth";
	import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
	import { defaults, superForm } from "sveltekit-superforms";
	import { valibot } from "sveltekit-superforms/adapters";

	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { PUBLIC_API_URL } from "$env/static/public";

	import { setAccessToken } from "$lib/authentication";
	import TextInput from "$lib/components/forms/TextInput.svelte";

	const superform = superForm(defaults(valibot(loginSchema)), {
		SPA: true,
		resetForm: false,
		validators: valibot(loginSchema),
		async onUpdate({ form }) {
			console.log(form.data);
			if (form.valid) {
				const result = await fetch(new URL("/auth/login", PUBLIC_API_URL), {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(form.data),
				});
				const response = await result.json();
				if (isSessionCreatedErrorResponse(response)) return (form.message = response.error);
				if (!isSessionCreatedSuccessResponse(response)) return;
				setAccessToken(response.accessToken);
				return await goto(resolve("/app/mail/"));
			}
		},
	});
	let { message } = superform;
</script>

<div class="flex h-[calc(100vh-4rem)] flex-col items-center justify-center">
	<div role="alert" class={["alert alert-error", { invisible: !$message }]}>
		<TriangleAlertIcon />
		<span>{$message}</span>
	</div>
	<form
		method="post"
		use:superform.enhance
		class="m-2 flex w-xl flex-col gap-2 rounded-2xl bg-base-200 p-6"
	>
		<TextInput {superform} field="username" label="Username" />
		<TextInput {superform} field="password" type="password" label="Password" />
		<button type="submit" class="btn btn-primary">Submit</button>
	</form>
</div>
