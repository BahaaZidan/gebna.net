import { Base64 } from "js-base64";

import type { ResolversInterfaceTypes, ResolversTypes } from "./resolvers.types";

type NodeImplementer = ResolversInterfaceTypes<ResolversTypes>["Node"] extends {
	__typename?: infer T;
}
	? NonNullable<T>
	: never;

export function toGlobalId(type: NodeImplementer, id: string | number): string {
	return Base64.encode(`${type}:${id}`);
}

export function fromGlobalId(globalId: string): { type: string; id: string } {
	const [type, id] = Base64.decode(globalId).split(":");
	return { type, id };
}
