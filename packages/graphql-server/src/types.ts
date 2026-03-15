import type { Session } from "@gebna/auth/server";
import type { DBInstance } from "@gebna/db";

export interface GraphQLResolverContext {
	viewer: Session["user"];
	db: DBInstance;
}
