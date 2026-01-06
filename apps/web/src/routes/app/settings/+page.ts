import { graphql } from "$houdini";

export const _houdini_load = graphql(`
	query UserSettingsPageQuery {
		viewer {
			...NavbarFragment
			id
			username
			name
			avatar
		}
	}
`);
