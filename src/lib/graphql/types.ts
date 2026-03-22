import type { Viewer } from "#/lib/auth/viewer";
import type { DBInstance } from "#/lib/db";

export interface GraphQLResolverContext {
	viewer: Viewer;
	db: DBInstance;
}
