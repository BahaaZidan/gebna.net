import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async (event) => {
	const viewer = event.locals.user;

	return { viewer };
};
