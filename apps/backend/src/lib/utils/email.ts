export function extractLocalPart(email: string) {
	const atIndex = email.indexOf("@");
	const lastAtIndex = email.lastIndexOf("@");

	if (atIndex <= 0 || atIndex !== lastAtIndex || atIndex === email.length - 1) {
		throw new Error("Invalid email address");
	}

	const localWithTag = email.slice(0, atIndex);
	const plusIndex = localWithTag.indexOf("+");

	return plusIndex === -1 ? localWithTag : localWithTag.slice(0, plusIndex);
}
