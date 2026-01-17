<script lang="ts">
	import { createForm, Field, Form } from "@formisch/svelte";
	import { isSessionCreatedErrorResponse, isSessionCreatedSuccessResponse } from "@gebna/types";
	import { loginSchema } from "@gebna/validation/auth";
	import type { IconProps } from "@lucide/svelte";
	import CogIcon from "@lucide/svelte/icons/cog";
	import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";
	import MessagesSquareIcon from "@lucide/svelte/icons/messages-square";
	import { type Component, type Snippet } from "svelte";

	import { resolve } from "$app/paths";
	import { type Pathname } from "$app/types";
	import { PUBLIC_API_URL } from "$env/static/public";

	import { SessionToken } from "$lib/auth";
	import TextInput from "$lib/components/forms/TextInput.svelte";

	import type { LayoutData } from "./$houdini";

	let props: { children: Snippet; data: LayoutData } = $props();
	let AppLayoutQuery = $derived(props.data.AppLayoutQuery);
	let viewer = $derived($AppLayoutQuery.data?.viewer);

	let loginForm = createForm({
		schema: loginSchema,
	});
	let loginErrorResponse: string | undefined = $state();
</script>

{#if !viewer}
	<div class="flex h-screen w-full items-center justify-center">
		<Form
			of={loginForm}
			onsubmit={async (output) => {
				const result = await fetch(new URL("/auth/login", PUBLIC_API_URL), {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(output),
				});
				const response = await result.json();
				if (isSessionCreatedErrorResponse(response)) return (loginErrorResponse = response.error);
				if (!isSessionCreatedSuccessResponse(response)) return;
				SessionToken.value = response.accessToken;
				location.reload();
			}}
		>
			<Field of={loginForm} path={["username"]}>
				{#snippet children(field)}
					<TextInput
						{...field.props}
						input={field.input}
						errors={field.errors}
						type="text"
						label="Username"
						required
					/>
				{/snippet}
			</Field>
			<Field of={loginForm} path={["password"]}>
				{#snippet children(field)}
					<TextInput
						{...field.props}
						input={field.input}
						errors={field.errors}
						type="password"
						label="Password"
						required
					/>
				{/snippet}
			</Field>
			<button type="submit" class="btn btn-primary">Submit</button>
		</Form>
	</div>
{:else}
	<main class="flex">
		<div class="flex h-screen w-16 flex-col items-center justify-between border-r py-3">
			<div class="flex flex-col">
				{@render iconLink({ route: "/app/desktop", label: "Dashboard", Icon: LayoutDashboardIcon })}
				{@render iconLink({
					route: "/app/desktop/mail",
					label: "Messages",
					Icon: MessagesSquareIcon,
				})}
			</div>
			<div class="flex flex-col">
				{@render iconLink({ route: "/app/desktop/settings", label: "Settings", Icon: CogIcon })}
				<div class="tooltip tooltip-right" data-tip="Profile">
					<button class="btn btn-ghost">
						<img
							class="size-6"
							src="https://img.daisyui.com/images/profile/demo/batperson@192.webp"
							alt="sadasds"
						/>
					</button>
				</div>
			</div>
		</div>
		<div class="w-full">
			{@render props.children()}
		</div>
	</main>
{/if}

{#snippet iconLink({
	route,
	label,
	Icon,
}: {
	route: Pathname;
	label: string;
	Icon: Component<IconProps>;
})}
	<div class="tooltip tooltip-right" data-tip={label}>
		<a class="btn btn-ghost" href={resolve(route)}>
			<Icon />
		</a>
	</div>
{/snippet}
