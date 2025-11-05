import { verify } from "@node-rs/argon2";
import { redirect } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import * as v from "valibot";

import * as auth from "$lib/server/auth";
import { getDB } from "$lib/server/db";

import type { Actions, PageServerLoad } from "./$types";

const schema = v.pipe(
	v.object({
		// TODO: tighter validation
		handle: v.pipe(v.string(), v.nonEmpty("Handle is required!")),
		password: v.pipe(v.string(), v.minLength(8, "Password is too short!")),
	})
);

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) return redirect(302, "/");

	const form = await superValidate(valibot(schema));

	return { form };
};

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event.request, valibot(schema));
		if (!form.valid) return message(form, "Invalid handle or password!");

		const db = getDB(event.platform?.env.DB);

		const existingUser = await db.query.user.findFirst({
			where: (users, { eq }) => eq(users.handle, form.data.handle),
		});
		if (!existingUser) return message(form, "Incorrect handle or password", { status: 400 });

		const validPassword = await verify(existingUser.passwordHash, form.data.password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1,
		});
		if (!validPassword) return message(form, "Incorrect handle or password", { status: 400 });

		const sessionToken = auth.generateSessionToken();
		const session = await auth.createSession(sessionToken, existingUser.id, event.platform?.env.DB);
		auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);

		return redirect(302, "/");
	},
};
