import { cache, graphql } from "$houdini";

export function getViewer() {
	let viewer = cache.read({
		query: graphql(`
			query ViewerSharedQuery {
				viewer {
					id
					identity {
						id
					}
				}
			}
		`),
	});

	return viewer.data?.viewer;
}
