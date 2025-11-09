import * as v from "valibot";

export const registerSchema = v.pipe(
	v.object({
		username: v.pipe(
			v.string(),
			v.nonEmpty("Username is required!"),
			v.regex(/^(?=.{1,64}$)(?!.*\.\.)[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/i)
		),
		password: v.pipe(v.string(), v.minLength(8, "Password is too short!")),
		passwordConfirm: v.string(),
	}),
	v.forward(
		v.partialCheck(
			[["password"], ["passwordConfirm"]],
			(input) => input.password === input.passwordConfirm,
			"Passwords do not match."
		),
		["passwordConfirm"]
	)
);
