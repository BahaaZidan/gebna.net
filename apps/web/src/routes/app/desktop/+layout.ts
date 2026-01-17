import { graphql } from "$houdini";

export const _houdini_load = graphql(`
	query MainViewerQuery {
		viewer {
			id
			username
			name
			avatar
			identity {
				id
			}
		}
	}
`);
