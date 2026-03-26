import { Field, Form, useForm } from "@formisch/react";
import type { SubmitHandler } from "@formisch/react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { authClient, TextInput } from "#/lib/auth/client";
import { registerSchema } from "#/lib/auth/validation-schemas";
import { buildPageMeta } from "#/lib/utils/seo";

import { Route as signInRoute } from "./signin";

export const Route = createFileRoute("/_auth/auth/signup")({
	component: RouteComponent,
	head: () => ({
		meta: buildPageMeta({
			title: "Create Account",
			description: "Create a gebna account.",
			robots: "noindex, nofollow",
		}),
	}),
});

function RouteComponent() {
	const signupForm = useForm({
		schema: registerSchema,
	});

	const handleSignUp: SubmitHandler<typeof registerSchema> = async ({
		username,
		password,
		name,
	}) => {
		const result = await authClient.signUp.email({
			username,
			name,
			password,
			email: `${username}@gebna.net`,
			// @ts-expect-error don't worry about it
			avatarPlaceholder: generateImagePlaceholder(name || username),
		});
		if (result.error) return;
		location.reload();
	};

	return (
		<div className="flex h-screen w-full flex-col items-center justify-center">
			<h1 className="mb-2 font-mono text-4xl">
				join <span>gebna</span>
			</h1>
			<div>
				or{" "}
				<Link className="link" to={signInRoute.to}>
					sign-in
				</Link>
			</div>

			<Form
				of={signupForm}
				onSubmit={handleSignUp}
				className="flex w-full max-w-sm flex-col gap-3"
			>
				<Field of={signupForm} path={["name"]}>
					{(field) => (
						<TextInput
							{...field.props}
							type="text"
							label="Name"
							input={field.input}
							errors={field.errors}
							required
						/>
					)}
				</Field>
				<Field of={signupForm} path={["username"]}>
					{(field) => (
						<TextInput
							{...field.props}
							type="text"
							label="Username"
							input={field.input}
							errors={field.errors}
							required
						/>
					)}
				</Field>
				<Field of={signupForm} path={["password"]}>
					{(field) => (
						<TextInput
							{...field.props}
							input={field.input}
							errors={field.errors}
							type="password"
							label="Password"
							required
						/>
					)}
				</Field>
				<Field of={signupForm} path={["passwordConfirm"]}>
					{(field) => (
						<TextInput
							{...field.props}
							input={field.input}
							errors={field.errors}
							type="password"
							label="Confirm Password"
							required
						/>
					)}
				</Field>
				<button type="submit" className="btn btn-primary">
					Submit
				</button>
			</Form>
		</div>
	);
}
