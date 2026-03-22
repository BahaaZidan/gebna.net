import { Field, Form, useForm, type SubmitHandler } from "@formisch/react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { authClient, TextInput } from "#/lib/auth/client";
import { loginSchema } from "#/lib/auth/validation-schemas";

import { Route as signUpRoute } from "./signup";

export const Route = createFileRoute("/_auth/auth/signin")({
	component: RouteComponent,
});

function RouteComponent() {
	const loginForm = useForm({
		schema: loginSchema,
	})
	const handleLogin: SubmitHandler<typeof loginSchema> = async ({
		username,
		password,
	}) => {
		const result = await authClient.signIn.username({ username, password });
		if (result.error) return;
		location.reload();
	}

	return (
		<div className="flex h-screen w-full flex-col items-center justify-center">
			<h1 className="mb-2 font-mono text-4xl">
				sign-in to <span>gebna</span>
			</h1>
			<div>
				or{" "}
				<Link className="link" to={signUpRoute.to}>
					create an account
				</Link>
			</div>

			<Form
				of={loginForm}
				onSubmit={handleLogin}
				className="flex w-full max-w-sm flex-col gap-3"
			>
				<Field of={loginForm} path={["username"]}>
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
				<Field of={loginForm} path={["password"]}>
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
				<button type="submit" className="btn btn-primary">
					Submit
				</button>
			</Form>
		</div>
	)
}
