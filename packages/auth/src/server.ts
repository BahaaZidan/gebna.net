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
type AuthServer = ReturnType<typeof betterAuth>;
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
}): AuthServer {
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

		hooks: {
			before: createAuthMiddleware(async (ctx) => {
				if (ctx.path !== "/sign-up/email" && ctx.path !== "/update-user") return;

				if (!ctx.body.username) {
					throw new APIError("BAD_REQUEST", {
						message: "Username is required",
					});
				}
			}),
			after: createAuthMiddleware(async (ctx) => {
				if (ctx.path !== "/sign-up/email") return;

				const user = ctx.context.session?.user;
				if (!user) return;

				try {
					await db.transaction(async (tx) => {
						await tx
							.insert(dbSchema.emailAddresses)
							.values({
								name: user.name,
								address: user.email,
								avatarPlaceholder: generateImagePlaceholder(user.name || user.email),
							})
							.onConflictDoNothing();

						await tx
							.insert(dbSchema.emailAddressRefs)
							.values({
								ownerId: user.id,
								address: user.email,
							})
							.onConflictDoNothing();
					});
				} catch (error) {
					ctx.context.logger.error("Failed to create signup email identity", error);

					// Drop any cookies prepared by sign-up before we return the failure.
					ctx.context.responseHeaders = new Headers();

					try {
						await ctx.context.internalAdapter.deleteUser(user.id);
					} catch (cleanupError) {
						ctx.context.logger.error(
							"Failed to clean up user after email identity creation failed",
							cleanupError
						);
					}

					throw new APIError("UNPROCESSABLE_ENTITY", {
						message: "Failed to create user",
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
		uploadedAvatar?: string;
		avatarPlaceholder: string;
	};
};
