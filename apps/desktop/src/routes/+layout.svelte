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
	import { TextInput } from "@gebna/ui";
	import { loginSchema } from "@gebna/vali";
	import EnvelopeSimpleIcon from "phosphor-svelte/lib/EnvelopeSimpleIcon";
	import EnvelopeSimpleOpenIcon from "phosphor-svelte/lib/EnvelopeSimpleOpenIcon";
	import GearFineIcon from "phosphor-svelte/lib/GearFineIcon";
	import MagnifyingGlassIcon from "phosphor-svelte/lib/MagnifyingGlassIcon";
	import { type Snippet } from "svelte";

	import { resolve } from "$app/paths";
	import { navigating, page } from "$app/state";
	import { env } from "$env/dynamic/public";

	import type { LayoutData } from "./$types";

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	let viewer = $derived(data.viewer);

	let loginForm = createForm({
		schema: loginSchema,
	});

	const handleLogin: SubmitHandler<typeof loginSchema> = async ({ username, password }) => {
		const result = await getAuthClient({ baseURL: env.PUBLIC_BASE_URL }).signIn.username({
			username,
			password,
		});
		if (result.error) return;
		location.reload();
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
		<div
			class={[
				"absolute h-1.5 max-h-1.5 w-full",
				{ [navigating.type !== null ? "visible" : "invisible"]: true },
			]}
		>
			<progress class="progress mb-3 h-1.5 w-full rounded-none"></progress>
		</div>
		<div class="flex h-screen w-16 min-w-16 flex-col items-center justify-between border-r py-3">
			<div class="flex w-16 flex-col gap-2">
				<div class="tooltip tooltip-right w-16" data-tip="Search">
					<a
						class={["btn w-16", page.url.pathname === "/" ? "btn-active" : "btn-ghost"]}
						href={resolve("/")}
					>
						<MagnifyingGlassIcon
							class="size-6"
							weight={page.url.pathname === "/" ? "bold" : "regular"}
						/>
					</a>
				</div>
				<div class="tooltip tooltip-right w-16" data-tip="Email">
					<a
						class={["btn w-16", page.url.pathname.includes("/email") ? "btn-active" : "btn-ghost"]}
						href={resolve("/email")}
					>
						{#if page.url.pathname.includes("/email")}
							<EnvelopeSimpleOpenIcon class="size-6" weight="bold" />
						{:else}
							<EnvelopeSimpleIcon class="size-6" weight="regular" />
						{/if}
					</a>
				</div>
			</div>
			<div class="flex w-16 flex-col gap-2">
				<div class="tooltip tooltip-right w-16" data-tip="Settings">
					<a
						class={["btn w-16", page.url.pathname === "/settings" ? "btn-active" : "btn-ghost"]}
						href={resolve("/settings")}
					>
						<GearFineIcon
							class="size-6"
							weight={page.url.pathname === "/settings" ? "bold" : "regular"}
						/>
					</a>
				</div>
				<div class="tooltip tooltip-right w-16" data-tip="Profile">
					<button class="btn w-16 btn-ghost">
						<img
							class="size-8"
							src={viewer.uploadedAvatar || viewer.avatarPlaceholder}
							alt="viewer avatar"
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
