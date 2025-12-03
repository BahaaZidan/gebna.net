import type { Resolvers } from "./resolvers.types";

export const resolvers: Resolvers = {
	Query: {
		viewer: async (_parent, _input, { session, db }) => {
			if (!session) return null;
			const currentUser = db.query.userTable.findFirst({
				where: (t, { eq }) => eq(t.id, session.userId),
			});
			return currentUser;
		},
	},
};
