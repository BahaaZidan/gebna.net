<script lang="ts">
	import { editUserSchema } from "@gebna/validation/identity";
	import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
	import { getContextClient, mutationStore, queryStore } from "@urql/svelte";
	import { defaults, fileProxy, superForm } from "sveltekit-superforms";
	import { valibot } from "sveltekit-superforms/adapters";

	import Container from "$lib/components/Container.svelte";
	import TextInput from "$lib/components/forms/TextInput.svelte";
	import Navbar from "$lib/components/Navbar.svelte";
	import { graphql } from "$lib/graphql/generated";
	import type { EditUserInput } from "$lib/graphql/generated/graphql";

	const urqlClient = getContextClient();
	const UserSettingsPageQuery = graphql(`
		query UserSettingsPageQuery {
			viewer {
				id
				username
				name
				avatar
			}
		}
	`);
	const userSettingsPageQuery = queryStore({
		client: urqlClient,
		query: UserSettingsPageQuery,
	});
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

	const editUser = (input: EditUserInput) => {
		mutationStore({
			client: urqlClient,
			query: EditUserMutation,
			variables: { input },
		});
	};

	const superform = superForm(defaults(valibot(editUserSchema)), {
		SPA: true,
		resetForm: false,
		validators: valibot(editUserSchema),
		async onUpdate({ form }) {
			if (form.valid) {
				editUser({
					name: form.data.name,
					avatar: form.data.avatar,
				});
			}
		},
	});
	let { message, constraints, form } = superform;
	const file = fileProxy(form, "avatar");
</script>

<Navbar />
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
