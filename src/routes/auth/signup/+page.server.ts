import { hash } from "@node-rs/argon2";
import { encodeBase32LowerCase } from "@oslojs/encoding";
import { redirect } from "@sveltejs/kit";
import { fail, message, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import * as v from "valibot";

import { resolve } from "$app/paths";

import * as auth from "$lib/server/auth";
import { getDB } from "$lib/server/db";
import * as table from "$lib/server/db/schema";

import type { Actions, PageServerLoad } from "./$types";

const schema = v.pipe(
	v.object({
		// TODO: tighter validation
		handle: v.pipe(v.string(), v.nonEmpty("Handle is required!")),
		password: v.pipe(v.string(), v.minLength(8, "Password is too short!")),
		passwordConfirm: v.string(),
	}),
	v.forward(
		v.partialCheck(
			[["password"], ["passwordConfirm"]],
			(input) => input.password === input.passwordConfirm,
			"Passwords do not match."
		),
		["passwordConfirm"]
	)
);

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) return redirect(302, "/");

	const form = await superValidate(valibot(schema));

	return { form };
};

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event.request, valibot(schema));
		if (!form.valid) {
			return message(form, "Invalid handle or password!");
		}

		const userId = generateUserId();
		const passwordHash = await hash(form.data.password, {
			// recommended minimum parameters
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1,
		});

		try {
			const db = getDB(event.platform?.env.DB);
			await db.insert(table.user).values({ id: userId, handle: form.data.handle, passwordHash });

			const sessionToken = auth.generateSessionToken();
			const session = await auth.createSession(sessionToken, userId, event.platform?.env.DB);
			auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
		} catch {
			return fail(500, { form, message: "An error has occurred" });
		}

		return redirect(302, resolve("/"));
	},
};

function generateUserId() {
	// ID with 120 bits of entropy, or about the same as UUID v4.
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	const id = encodeBase32LowerCase(bytes);
	return id;
}
