import type { Resolvers } from "./resolvers.types";

export const resolvers: Resolvers = {
	Query: {
		hello: () => {
			return "loloooooo";
		},
	},
};
