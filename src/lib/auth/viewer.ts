import { createServerFn } from "@tanstack/react-start";
import type { User } from "better-auth";
import type { DBFieldAttribute, InferFieldsOutput } from "better-auth/db";

export const authUserAdditionalFields = {
	uploadedAvatar: {
		type: "string",
		required: false,
	},
	avatarPlaceholder: {
		type: "string",
		required: true,
	},
} satisfies Record<string, DBFieldAttribute>;

type AuthUserAdditionalFields = InferFieldsOutput<typeof authUserAdditionalFields>;

export type Viewer = User & AuthUserAdditionalFields;

export const getViewer = createServerFn({ method: "GET" }).handler(
	async () => {
		const { getRequest } = await import("@tanstack/react-start/server");
		const { auth } = await import("./server");
		const request = getRequest();

		const session = await auth.api.getSession({
			headers: request.headers,
			asResponse: false,
		});

		return (session?.user ?? null) as Viewer | null;
	},
);
