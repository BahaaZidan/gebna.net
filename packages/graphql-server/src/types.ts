import type { Session } from "@gebna/auth/server";
import type { DBInstance } from "@gebna/db";

type RemoveUndefined<T> = Exclude<T, undefined>;

// make all props required, and remove `undefined` from each prop’s union
export type PropsToNullable<T> = {
	[K in keyof T]-?: RemoveUndefined<T[K]>;
};

// optional: force TS to show the expanded result in hovers
export type Simplify<T> = { [K in keyof T]: T[K] } & {};

export interface GraphQLResolverContext {
	viewer: Simplify<PropsToNullable<Session["user"]>>;
	db: DBInstance;
}
