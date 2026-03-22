import type { FieldElementProps } from "@formisch/react";
import clsx from "clsx";

interface TextInputProps extends FieldElementProps {
	type: "text" | "email" | "tel" | "password" | "url" | "date";
	label?: string;
	placeholder?: string;
	input: string | undefined;
	errors: [string, ...string[]] | null;
	required?: boolean;
}

export function TextInput({ label, input, errors, ...props }: TextInputProps) {
	const { name, required } = props;
	return (
		<fieldset className="fieldset">
			<legend className="fieldset-legend">
				{label} {required && <span className="text-error">*</span>}
			</legend>
			<input
				{...props}
				id={name}
				name={name}
				className={clsx("input w-full", {
					"input-error": errors,
				})}
				required={required}
				value={input ?? ""}
				aria-invalid={!!errors}
				aria-errormessage={`${name}-error`}
			/>
			{errors && <p className="label text-error">{errors[0]}</p>}
		</fieldset>
	);
}
