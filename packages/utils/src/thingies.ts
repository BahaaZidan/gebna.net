export function stripAngleBrackets(value: string): string {
	if (value.startsWith("<") && value.endsWith(">")) {
		return value.slice(1, -1);
	}
	return value;
}
