export async function scheduledHandler(
	controller: ScheduledController,
	bindings: CloudflareBindings
) {
	switch (controller.cron) {
		case "0 * * * *":
			await trashMailboxGC(bindings);
			break;
		case "30 */6 * * *":
			await attachmentsGC(bindings);
			break;
		default:
			break;
	}
}

async function trashMailboxGC(_bindings: CloudflareBindings) {
	console.log("trashMailboxGC skipped (thread table not present)");
}

async function attachmentsGC(_bindings: CloudflareBindings) {
	console.log("attachmentsGC skipped (attachment table not present)");
}
