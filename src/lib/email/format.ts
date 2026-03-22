export function formatInboxDate(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";

	const now = new Date();
	const isSameDay =
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth() &&
		date.getDate() === now.getDate();

	if (isSameDay) {
		return new Intl.DateTimeFormat(undefined, {
			hour: "numeric",
			minute: "2-digit",
		})
			.format(date)
			.replace(/\s/g, "")
			.toLowerCase();
	}

	if (date.getFullYear() === now.getFullYear()) {
		return new Intl.DateTimeFormat(undefined, {
			month: "short",
			day: "numeric",
		}).format(date);
	}

	return new Intl.DateTimeFormat("en-GB", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(date);
}
