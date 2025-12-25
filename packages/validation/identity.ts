import * as v from "valibot";

export const editUserSchema = v.object({
	name: v.optional(v.pipe(v.string(), v.trim(), v.nonEmpty(), v.maxLength(30))),
	avatar: v.optional(
		v.pipe(
			v.file("Please select an image file."),
			v.mimeType(["image/jpeg", "image/png"], "Please select a JPEG or PNG file."),
			v.maxSize(1024 * 1024 * 1, "Please select a file smaller than 1 MB.")
		)
	),
});
