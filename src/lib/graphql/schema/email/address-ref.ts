import { and, eq } from "drizzle-orm";
import * as v from "valibot";

import { dbSchema } from "#/lib/db";

import { builder } from "../builder";

export const EmailAddressRefRef = builder.drizzleNode("emailAddressRefs", {
	name: "EmailAddressRef",
	id: {
		column: (t) => t.id,
	},
	select: {
		columns: {
			ownerId: true,
			givenName: true,
			givenAvatar: true,
		},
		with: { address_: true },
	},
	authScopes: (m) => ({ ownedByViewer: m.ownerId }),
	fields: (t) => ({
		address: t.exposeString("address", { nullable: false }),
		name: t.string({
			nullable: false,
			resolve: (ref) =>
				ref.givenName || ref.address_?.name || ref.address_?.address!,
		}),
		avatar: t.string({
			nullable: false,
			resolve: (ref) =>
				ref.givenAvatar ||
				ref.address_?.inferredAvatar ||
				ref.address_?.avatarPlaceholder!,
		}),
		isSelf: t.boolean({
			nullable: false,
			resolve: (ref, _args, ctx) => ctx.viewer.email === ref.address_?.address,
		}),
		isBlocked: t.exposeBoolean("isBlocked", { nullable: false }),
		isSpam: t.exposeBoolean("isSpam", { nullable: false }),
		attachments: t.relatedConnection("authoredAttachments", {
			nullable: false,
			nodeNullable: false,
			edgesNullable: false,
		}),
		threads: t.relatedConnection("emailThreads", {
			nullable: false,
			nodeNullable: false,
			edgesNullable: false,
		}),
	}),
});

builder.relayMutationField(
	"updateEmailAddressRef",
	{
		inputFields: (t) => ({
			address: t.string({
				required: true,
				validate: v.pipe(v.string(), v.trim(), v.nonEmpty(), v.email()),
			}),
			givenName: t.string({
				validate: v.optional(
					v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(30)),
				),
			}),
			givenAvatar: t.string({
				validate: v.optional(
					v.pipe(v.string(), v.trim(), v.nonEmpty(), v.url()),
				),
			}),
			isBlocked: t.boolean(),
			isSpam: t.boolean(),
		}),
	},
	{
		resolve: async (_root, { input }, ctx) => {
			let table = dbSchema.emailAddressRefs;
			let [addressRef] = await ctx.db
				.update(table)
				.set({
					givenAvatar: input.givenAvatar,
					givenName: input.givenName,
					isBlocked: input.isBlocked!,
					isSpam: input.isSpam!,
				})
				.where(
					and(
						eq(table.address, input.address),
						eq(table.ownerId, ctx.viewer.id),
					),
				)
				.returning();
			return addressRef;
		},
	},
	{
		outputFields: (t) => ({
			result: t.field({
				type: EmailAddressRefRef,
				resolve: async (result, _root, ctx) => {
					if (!result) return;
					let address_ = (await ctx.db.query.emailAddresses.findFirst({
						where: { address: result.address },
					}))!;
					return { ...result, address_ };
				},
			}),
		}),
	},
);
