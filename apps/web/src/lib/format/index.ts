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

	return format(d, "dd/MM/yyyy");
}

export function formatSizeInBytes(sizeInBytes: number): string {
	const kb = 1024;
	const mb = kb * 1024;

	if (sizeInBytes >= mb) {
		const sizeInMb = sizeInBytes / mb;
		return `${Math.round(sizeInMb * 100) / 100} MB`;
	}

	const sizeInKb = sizeInBytes / kb;
	return `${Math.round(sizeInKb * 100) / 100} KB`;
}
