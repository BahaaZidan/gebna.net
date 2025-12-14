import { format, isSameDay, isSameYear } from "date-fns";

export function formatInboxDate(date: Date | string): string {
	const now = new Date();
	const d = new Date(date);
	if (isSameDay(d, now)) {
		return format(d, "h:mmaaa").toLowerCase(); // "9:46am"
	}

	if (isSameYear(d, now)) {
		return format(d, "MMM d"); // "Jun 12"
	}

	return format(d, "MMM d, yyyy"); // "Jun 12, 2023"
}
