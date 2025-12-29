import * as v from "valibot";

export const editThreadSchema = v.object({
	title: v.pipe(v.string(), v.trim(), v.minLength(3), v.maxLength(150)),
});
