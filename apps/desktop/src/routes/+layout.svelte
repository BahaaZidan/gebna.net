<script lang="ts">
	import "./layout.css";
	import "@fontsource/inter/200";
	import "@fontsource/inter/300";
	import "@fontsource/inter/400";
	import "@fontsource/inter/500";
	import "@fontsource/inter/600";
	import "@fontsource/inter/700";
	import "@fontsource/inter/800";

	import { createForm, Field, Form, type SubmitHandler } from "@formisch/svelte";
	import { getAuthClient } from "@gebna/auth/client";
	import { loginSchema } from "@gebna/vali";
	import type { IconProps } from "@lucide/svelte";
	import CogIcon from "@lucide/svelte/icons/cog";
	import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";
	import MessagesSquareIcon from "@lucide/svelte/icons/messages-square";
	import { type Component, type Snippet } from "svelte";

	import { resolve } from "$app/paths";
	import { type Pathname } from "$app/types";

	import TextInput from "$lib/components/forms/TextInput.svelte";

	import type { LayoutData } from "./$types";

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	let viewer = $derived(data.user);

	let loginForm = createForm({
		schema: loginSchema,
	});

	const handleLogin: SubmitHandler<typeof loginSchema> = async ({ username, password }) => {
		const result = await getAuthClient().signIn.username({ username, password });
		console.log({ result });
		// location.reload();
	};
</script>

{#if !viewer}
	<div class="flex h-screen w-full items-center justify-center">
		<Form of={loginForm} onsubmit={handleLogin}>
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
	<main
		class="flex h-screen max-h-screen min-h-screen w-screen max-w-screen min-w-screen overflow-hidden"
	>
		<div class="flex h-screen w-16 min-w-16 flex-col items-center justify-between border-r py-3">
			<div class="flex flex-col">
				{@render iconLink({ route: "/", label: "Dashboard", Icon: LayoutDashboardIcon })}
				{@render iconLink({
					route: "/messages",
					label: "Messages",
					Icon: MessagesSquareIcon,
				})}
			</div>
			<div class="flex flex-col">
				{@render iconLink({ route: "/settings", label: "Settings", Icon: CogIcon })}
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
		<div class="flex h-full min-h-0 w-full flex-col overflow-hidden">
			{@render children()}
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
