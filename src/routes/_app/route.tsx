import {
	autoUpdate,
	flip,
	offset,
	shift,
	useClick,
	useDismiss,
	useFloating,
	useInteractions,
	useRole,
} from "@floating-ui/react";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/ssr/EnvelopeSimple";
import { EnvelopeSimpleOpenIcon } from "@phosphor-icons/react/dist/ssr/EnvelopeSimpleOpen";
import { GearFineIcon } from "@phosphor-icons/react/dist/ssr/GearFine";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { SignOutIcon } from "@phosphor-icons/react/dist/ssr/SignOut";
import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
	useHydrated,
	useMatchRoute,
	useRouterState,
} from "@tanstack/react-router";
import clsx from "clsx";
import { useState } from "react";

import { authClient } from "#/lib/auth/client";

import { Route as emailIndexRoute } from "./app/email/index";
import { Route as appIndexRoute } from "./app/index";
import { Route as settingsIndexRoute } from "./app/settings/index";

export const Route = createFileRoute("/_app")({
	beforeLoad: ({ context, location }) => {
		if (context.viewer) return;

		throw redirect({
			to: "/auth/signin",
			search: {
				redirect: location.href,
			},
		});
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { viewer } = Route.useRouteContext();
	const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
	const { refs, floatingStyles, context } = useFloating({
		open: isAccountMenuOpen,
		onOpenChange: setIsAccountMenuOpen,
		placement: "right-end",
		whileElementsMounted: autoUpdate,
		middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
	});
	const click = useClick(context);
	const dismiss = useDismiss(context);
	const role = useRole(context, { role: "menu" });
	const { getReferenceProps, getFloatingProps } = useInteractions([
		click,
		dismiss,
		role,
	]);
	const hydrated = useHydrated();
	const isNavigating = useRouterState({
		select: (s) => s.status === "pending",
	});
	const showNavigationProgress = hydrated && isNavigating;
	const matchRoute = useMatchRoute();
	let isSearchActive = !!matchRoute({ to: "/app", fuzzy: false });
	let isEmailActive = !!matchRoute({ to: "/app/email", fuzzy: true });
	let isSettingsActive = !!matchRoute({ to: "/app/settings", fuzzy: true });

	return (
		<main className="flex h-screen max-h-screen min-h-screen w-screen max-w-screen min-w-screen overflow-hidden">
			<div
				className={clsx(
					"absolute h-1.5 max-h-1.5 w-full",
					showNavigationProgress ? "visible" : "invisible",
				)}
			>
				<progress className="progress mb-3 h-1.5 w-full rounded-none"></progress>
			</div>
			<div className="flex h-screen w-16 min-w-16 flex-col items-center justify-between border-r py-3">
				<div className="flex w-16 flex-col gap-2">
					<div className="tooltip tooltip-right w-16" data-tip="Search">
						<Link
							className={clsx(
								"btn w-16",
								isSearchActive ? "btn-accent" : "btn-ghost",
							)}
							to={appIndexRoute.to}
						>
							<MagnifyingGlassIcon
								className="size-6"
								weight={isSearchActive ? "bold" : "regular"}
							/>
						</Link>
					</div>
					<div className="tooltip tooltip-right w-16" data-tip="Email">
						<Link
							className={clsx(
								"btn w-16",
								isEmailActive ? "btn-accent" : "btn-ghost",
							)}
							to={emailIndexRoute.to}
						>
							{isEmailActive ? (
								<EnvelopeSimpleOpenIcon className="size-6" weight="bold" />
							) : (
								<EnvelopeSimpleIcon className="size-6" weight="regular" />
							)}
						</Link>
					</div>
				</div>
				<div className="flex w-16 flex-col gap-2">
					<div className="tooltip tooltip-right w-16" data-tip="Settings">
						<Link
							className={clsx(
								"btn w-16",
								isSettingsActive ? "btn-accent" : "btn-ghost",
							)}
							to={settingsIndexRoute.to}
						>
							<GearFineIcon
								className="size-6"
								weight={isSettingsActive ? "bold" : "regular"}
							/>
						</Link>
					</div>
					<div className="relative">
						<button
							ref={refs.setReference}
							type="button"
							className="btn w-16 btn-ghost"
							{...getReferenceProps({
								"aria-label": "Open account menu",
							})}
						>
							<img
								className="size-8"
								src={viewer?.uploadedAvatar || viewer?.avatarPlaceholder}
								alt="viewer avatar"
							/>
						</button>
						{isAccountMenuOpen ? (
							<ul
								ref={refs.setFloating}
								style={floatingStyles}
								className="menu z-50 w-52 rounded-box border border-base-300 bg-base-100 p-2 shadow-xl"
								{...getFloatingProps()}
							>
								<li>
									<button
										type="button"
										onClick={async () => {
											setIsAccountMenuOpen(false);
											await authClient.signOut();
											location.reload();
										}}
									>
										<SignOutIcon className="size-6" />
										Logout
									</button>
								</li>
							</ul>
						) : null}
					</div>
				</div>
			</div>
			<div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
				<Outlet />
			</div>
		</main>
	);
}
