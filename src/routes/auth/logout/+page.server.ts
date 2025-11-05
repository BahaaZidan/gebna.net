import { fail, redirect } from "@sveltejs/kit";

import { resolve } from "$app/paths";

import * as auth from "$lib/server/auth";

import type { Actions } from "./$types";

export const actions: Actions = {
	default: async (event) => {
		if (!event.locals.session) {
			return fail(401);
		}
		await auth.invalidateSession(event.locals.session.id, event.platform?.env.DB);
		auth.deleteSessionTokenCookie(event);

		return redirect(302, resolve("/auth/login"));
	},
};
