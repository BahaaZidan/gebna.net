import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/app/email/")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="flex h-full min-h-0 items-center justify-center p-8">
			<div className="max-w-sm text-center">
				<h2 className="text-xl font-semibold">Select a thread</h2>
				<p className="mt-2 text-sm text-base-content/60">
					Choose a conversation from the inbox to read messages and attachments.
				</p>
			</div>
		</div>
	);
}
