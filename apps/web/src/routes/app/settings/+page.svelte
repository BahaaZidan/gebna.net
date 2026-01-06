<script lang="ts">
	import { editUserSchema } from "@gebna/validation/identity";
	import { defaults, fileProxy, superForm } from "sveltekit-superforms";
	import { valibot } from "sveltekit-superforms/adapters";

	import { graphql } from "$houdini";

	import Container from "$lib/components/Container.svelte";
	import TextInput from "$lib/components/forms/TextInput.svelte";
	import Navbar from "$lib/components/Navbar.svelte";

	import type { PageData } from "./$houdini";

	let props: { data: PageData } = $props();
	const userSettingsPageQuery = $derived(props.data.UserSettingsPageQuery);
	const viewer = $derived($userSettingsPageQuery.data?.viewer);

	const EditUserMutation = graphql(`
		mutation EditUserMutation($input: EditUserInput!) {
			editUser(input: $input) {
				id
				name
				avatar
			}
		}
	`);

	const superform = superForm(defaults(valibot(editUserSchema)), {
		SPA: true,
		resetForm: false,
		validators: valibot(editUserSchema),
		async onUpdate({ form }) {
			if (form.valid) {
				EditUserMutation.mutate({
					input: {
						name: form.data.name,
						avatar: form.data.avatar,
					},
				});
			}
		},
	});
	let { constraints, form } = superform;
	const file = fileProxy(form, "avatar");
</script>

<Navbar {viewer} />
<Container>
	<div class="divider">Profile Settings</div>
	<form
		method="post"
		enctype="multipart/form-data"
		use:superform.enhance
		class="flex flex-col gap-2"
	>
		<TextInput {superform} field="name" label="Name" />
		<input class="input" type="file" name="avatar" bind:files={$file} {...$constraints.avatar} />
		<button type="submit" class="btn btn-primary">Submit</button>
	</form>
</Container>
