import { query } from "$app/server";

export const getViewer = query(async () => {
	await new Promise((resolve) => setTimeout(resolve, 2000));
	return "viewer";
});
