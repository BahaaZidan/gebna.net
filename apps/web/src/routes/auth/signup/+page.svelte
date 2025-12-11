<script lang="ts">
	import { isSessionCreatedErrorResponse, isSessionCreatedSuccessResponse } from "@gebna/types";
	import { registerSchema } from "@gebna/validation/auth";
	import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
	import { defaults, superForm } from "sveltekit-superforms";
	import { valibot } from "sveltekit-superforms/adapters";

	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { PUBLIC_API_URL } from "$env/static/public";

	import { setAccessToken } from "$lib/authentication";
	import TextInput from "$lib/components/forms/TextInput.svelte";

	const superform = superForm(defaults(valibot(registerSchema)), {
		SPA: true,
		resetForm: false,
		validators: valibot(registerSchema),
		async onUpdate({ form }) {
			if (form.valid) {
				const result = await fetch(new URL("/auth/register", PUBLIC_API_URL), {
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
				await goto(resolve("/app/mail/"));
				location.reload();
			}
		},
	});
	let { message } = superform;
</script>

<div class="flex h-screen flex-col items-center justify-center">
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
		<TextInput {superform} field="passwordConfirm" type="password" label="Confirm password" />
		<button type="submit" class="btn btn-primary">Submit</button>
	</form>
</div>
