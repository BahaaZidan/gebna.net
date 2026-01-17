import { graphql } from "$houdini";

export const _houdini_load = graphql(`
	query AppLayoutQuery {
		viewer {
			id
			username
			name
			avatar
		}
	}
`);
