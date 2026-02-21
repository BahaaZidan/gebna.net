import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { dbSchema, type DBInstance } from "@gebna/db";
import { generateImagePlaceholder, ulid } from "@gebna/utils";
import { usernameSchema, v } from "@gebna/vali";
import { type RequestEvent } from "@sveltejs/kit";
import { APIError, betterAuth } from "better-auth";
import { createAuthMiddleware, username } from "better-auth/plugins";
import { sveltekitCookies } from "better-auth/svelte-kit";

export { svelteKitHandler } from "better-auth/svelte-kit";

// TODO: creating a custom adapter is the only way we can guarantee that each user record is bound to have an identity record.

export function getAuthServer({
	db,
	secret,
	baseURL,
	getRequestEvent,
}: {
	secret: string;
	baseURL: string;
	db: DBInstance;
	getRequestEvent: () => RequestEvent;
}) {
	return betterAuth({
		secret,
		baseURL,
		database: drizzleAdapter(db, {
			provider: "sqlite",
			usePlural: true,
			camelCase: true,
			transaction: true,
			schema: dbSchema,
		}),
		emailAndPassword: {
			enabled: true,
		},
		plugins: [
			username({
				usernameValidator(username) {
					return v.safeParse(usernameSchema, username).success;
				},
			}),
			// INTENTIONAL: make sure `sveltekitCookies` is the last in the plugins array.
			sveltekitCookies(getRequestEvent),
		],

		user: {
			additionalFields: {
				uploadedAvatar: {
					type: "string",
					required: false,
				},
				avatarPlaceholder: {
					type: "string",
					required: true,
				},
			},
		},

		advanced: {
			database: {
				generateId: () => ulid(),
			},
		},

		databaseHooks: {
			user: {
				create: {
					async after(user) {
						await db.transaction(async (tx) => {
							const [addressRecord] = await tx
								.insert(dbSchema.emailAddresses)
								.values({
									name: user.name,
									address: user.email,
									avatarPlaceholder: generateImagePlaceholder(user.name || user.email),
								})
								.returning();
							if (!addressRecord) throw new Error("something_went_wrong");

							await tx.insert(dbSchema.emailAddressRefs).values({
								ownerId: user.id,
								address: addressRecord.address,
							});
						});
					},
				},
			},
		},

		hooks: {
			before: createAuthMiddleware(async (ctx) => {
				if (ctx.path !== "/sign-up/email" && ctx.path !== "/update-user") return;

				if (!ctx.body.username) {
					throw new APIError("BAD_REQUEST", {
						message: "Username is required",
					});
				}
			}),
		},

		logger: {
			disabled: false,
			disableColors: false,
			log(level, message, ...args) {
				console.log(`[${level}] ${message}`, ...args);
			},
		},
	});
}
export type AuthServerInstance = ReturnType<typeof getAuthServer>;

type BaseSession = ReturnType<typeof getAuthServer>["$Infer"]["Session"];
export type Session = BaseSession & {
	user: BaseSession["user"] & {
		username: string;
	};
};
