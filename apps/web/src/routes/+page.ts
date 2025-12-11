import { redirect } from "@sveltejs/kit";

import { browser } from "$app/environment";
import { resolve } from "$app/paths";

import { getAccessToken } from "$lib/authentication";

import type { PageLoad } from "./$types";

export const load: PageLoad = async (event) => {
	if (!browser) return;
	if (getAccessToken()) return redirect(302, event.url.origin + resolve("/app"));
};
