import { builder } from "./builder";

export const ViewerRef = builder.drizzleObject("users", {
	name: "Viewer",
	select: {
		columns: {
			id: true,
			avatarPlaceholder: true,
			uploadedAvatar: true,
		},
	},
	fields: (t) => ({
		id: t.globalID({
			nullable: false,
			resolve: (parent) => {
				return { id: parent.id, type: "Viewer" };
			},
		}),
		name: t.exposeString("name", { nullable: false }),
		avatar: t.string({
			nullable: false,
			resolve: (user) => user.uploadedAvatar || user.avatarPlaceholder,
		}),
		emailAddress: t.exposeString("email", { nullable: false }),
		emailThreads: t.relatedConnection("emailThreads", {
			nullable: false,
			edgesNullable: false,
			nodeNullable: false,
			query: () => ({
				orderBy: {
					lastMessageAt: "desc",
				},
			}),
		}),
	}),
});

builder.queryField("viewer", (t) =>
	t.drizzleField({
		type: ViewerRef,
		resolve(query, _parent, _args, ctx) {
			return ctx.db.query.users.findFirst(
				query({ where: { id: ctx.viewer.id } }),
			);
		},
	}),
);
