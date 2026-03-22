import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth")({
	beforeLoad: ({ context }) => {
		if (!context.viewer) return;

		throw redirect({
			to: "/app",
		})
	},
	component: RouteComponent,
});

function RouteComponent() {
	return <Outlet />;
}
