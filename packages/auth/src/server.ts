import { dbSchema, type DBInstance } from "@gebna/db";
import { generateImagePlaceholder, ulid } from "@gebna/utils";
import { usernameSchema, v } from "@gebna/vali";
import { type RequestEvent } from "@sveltejs/kit";
import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
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
			schema: {
				user: dbSchema.userTable,
				account: dbSchema.accountTable,
				session: dbSchema.sessionTable,
				verification: dbSchema.verificationTable,
			},
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
						await db.insert(dbSchema.identityTable).values({
							id: ulid(),
							avatarPlaceholder: generateImagePlaceholder(user.name || user.email),
							kind: "GEBNA_USER",
							ownerId: user.id,
							address: user.email,
							name: user.name,
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
