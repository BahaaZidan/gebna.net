import "@tanstack/react-start/server-only";

import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { APIError, betterAuth } from "better-auth";
import { createAuthMiddleware, username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { env } from "cloudflare:workers";
import { ulid } from "ulid";
import * as v from "valibot";

import { db, dbSchema } from "#/lib/db";
import { generateImagePlaceholder } from "#/lib/utils/users";

import { authUserAdditionalFields } from "./viewer";
import { usernameSchema } from "./validation-schemas";

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.VITE_BASE_URL,
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
		// INTENTIONAL: make sure `tanstackStartCookies` is the last in the plugins array.
		tanstackStartCookies(),
	],

	user: {
		additionalFields: authUserAdditionalFields,
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
							avatarPlaceholder: generateImagePlaceholder(
								user.name || user.email,
							),
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
				ctx.context.logger.error(
					"Failed to create signup email identity",
					error,
				);

				// Drop any cookies prepared by sign-up before we return the failure.
				ctx.context.responseHeaders = new Headers();

				try {
					await ctx.context.internalAdapter.deleteUser(user.id);
				} catch (cleanupError) {
					ctx.context.logger.error(
						"Failed to clean up user after email identity creation failed",
						cleanupError,
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

type AuthServerInstance = typeof auth;
export type Session = AuthServerInstance["$Infer"]["Session"];
