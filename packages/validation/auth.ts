import * as v from "valibot";

const localRegex = /^(?![.])(?!.*\.\.)[a-z0-9.]{1,30}(?<![.])$/;

export const registerSchema = v.pipe(
	v.object({
		username: v.pipe(
			v.string(),
			v.trim(),
			v.nonEmpty("Username is required!"),
			v.toLowerCase(),
			v.regex(
				localRegex,
				"Username must only contain letters, digits, and dots with no leading, trailing, or consecutive dots."
			)
		),
		password: v.pipe(
			v.string(),
			v.minLength(12, "Password must be at least 12 characters."),
			v.regex(/[A-Z]/, "Include at least one uppercase letter (A-Z)."),
			v.regex(/[a-z]/, "Include at least one lowercase letter (a-z)."),
			v.regex(/[0-9]/, "Include at least one digit (0-9)."),
			v.regex(/[^A-Za-z0-9]/, "Include at least one symbol (e.g. !@#$%)."),
			v.regex(/^(?!.*(.)\1{2,}).*$/, "Avoid 3+ identical characters in a row.")
		),
		passwordConfirm: v.string(),
		name: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	}),

	// 1) passwords must match
	v.forward(
		v.partialCheck(
			[["password"], ["passwordConfirm"]],
			(i) => i.password === i.passwordConfirm,
			"Passwords do not match."
		),
		["passwordConfirm"]
	),

	// 2) password must NOT contain username (case-insensitive)
	v.forward(
		v.partialCheck(
			[["password"], ["username"]],
			(i) => !i.password.toLowerCase().includes(i.username.toLowerCase()),
			"Password must not contain your username."
		),
		["password"]
	)
);

export const loginSchema = v.object({
	username: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.regex(localRegex, "Invalid username!")),
	password: v.pipe(v.string(), v.nonEmpty("Password is required!")),
});
