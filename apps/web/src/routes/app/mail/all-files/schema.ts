import { v } from "@gebna/validation";

import { AttachmentType } from "$houdini";

export const searchParamsSchema = v.object({
	attachmentType: v.optional(
		v.pipe(v.string(), v.trim(), v.picklist(Object.values(AttachmentType))),
		// WORKAROUND: null/undefined defaults don't work at all with runed.useSearchParams. so we have to add this empty string default.
		""
	),
	contactAddress: v.optional(
		v.pipe(v.string(), v.trim(), v.email()),
		// WORKAROUND: null/undefined defaults don't work at all with runed.useSearchParams. so we have to add this empty string default.
		""
	),
});
