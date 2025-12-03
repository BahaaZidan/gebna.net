import type { Resolvers } from "./resolvers.types";
import { toGlobalId } from "./utils";

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
	Node: {
		__resolveType(parent) {
			return parent.__typename;
		},
	},
	User: {
		id: (parent) => toGlobalId("User", parent.id),
	},
};
