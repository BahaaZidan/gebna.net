import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { NotePencilIcon } from "@phosphor-icons/react/dist/ssr/NotePencil";
import {
	createFileRoute,
	Link,
	Outlet,
	useHydrated,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import clsx from "clsx";
import { Suspense } from "react";
import { graphql, useLazyLoadQuery, usePaginationFragment } from "react-relay";

import { ThreadAvatar, ThreadTitle } from "#/lib/email/components";
import { formatInboxDate } from "#/lib/email/format";

import type { routePaginationQuery } from "./__generated__/routePaginationQuery.graphql";
import type { routeQuery } from "./__generated__/routeQuery.graphql";
import type { routeViewer$key } from "./__generated__/routeViewer.graphql";
import { Route as emailThreadRoute } from "./$thread_id";

export const Route = createFileRoute("/_app/app/email")({
	component: RouteComponent,
});

function RouteComponent() {
	const hydrated = useHydrated();

	if (!hydrated) {
		return <EmailLayoutSkeleton />;
	}

	return (
		<Suspense fallback={<EmailLayoutSkeleton />}>
			<EmailThreadsLayoutQueryBoundary />
		</Suspense>
	);
}

const PAGE_SIZE = 25;

function EmailThreadsLayoutQueryBoundary() {
	const data = useLazyLoadQuery<routeQuery>(
		graphql`
			query routeQuery($first: Int!, $after: String) {
				viewer {
					...routeViewer @arguments(first: $first, after: $after)
				}
			}
		`,
		{ first: PAGE_SIZE },
		{ fetchPolicy: "store-or-network" },
	);

	if (!data.viewer) {
		return (
			<div className="flex h-full min-h-0 items-center justify-center">
				<div className="text-sm text-base-content/60">No viewer found.</div>
			</div>
		);
	}

	return <EmailThreadsLayout viewer={data.viewer} />;
}

function EmailThreadsLayout({ viewer }: { viewer: routeViewer$key }) {
	const router = useRouter();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const { data, hasNext, isLoadingNext, loadNext } = usePaginationFragment<
		routePaginationQuery,
		routeViewer$key
	>(
		graphql`
			fragment routeViewer on Viewer
			@argumentDefinitions(
				first: { type: "Int", defaultValue: 25 }
				after: { type: "String" }
			)
			@refetchable(queryName: "routePaginationQuery") {
				emailThreads(first: $first, after: $after)
					@connection(key: "route_emailThreads") {
					edges {
						node {
							id
							...componentsThreadAvatar
							...componentsThreadTitle
							unseenCount
							lastMessage {
								id
								createdAt
								from {
									id
									name
									address
								}
							}
						}
					}
					pageInfo {
						hasNextPage
					}
				}
			}
		`,
		viewer,
	);

	return (
		<div className="flex h-full min-h-0 flex-col lg:flex-row">
			<div className="flex min-h-72 w-full flex-col gap-1 border-b py-3 lg:h-full lg:w-[50%] lg:max-w-[50%] lg:min-w-88 lg:border-r lg:border-b-0">
				<div className="flex items-center justify-between px-5">
					<h1 className="font-mono text-2xl font-bold">gebna</h1>
					<div className="tooltip tooltip-bottom" data-tip="New Mail">
						<button
							type="button"
							className="btn btn-ghost p-2"
							aria-label="New Mail"
						>
							<NotePencilIcon className="size-6" />
						</button>
					</div>
				</div>
				<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
					{data.emailThreads.edges.map((edge) => {
						const thread = edge.node;
						const threadPath = router.buildLocation({
							to: emailThreadRoute.to,
							params: { thread_id: thread.id },
						}).pathname;
						const isActive = pathname === threadPath;

						return (
							<Link
								key={thread.id}
								to={emailThreadRoute.to}
								params={{ thread_id: thread.id }}
								className={clsx(
									"group flex w-full items-center gap-3 px-5 py-3 hover:bg-base-200",
									isActive ? "bg-base-300" : null,
								)}
							>
								<ThreadAvatar
									thread={thread}
									className="size-12 min-h-12 min-w-12 bg-accent-content"
								/>
								<div className="flex min-w-0 flex-1 flex-col gap-1">
									<div className="flex items-baseline justify-between gap-3">
										<div
											className={clsx(
												"line-clamp-1 min-w-0 text-sm",
												thread.unseenCount > 0 ? "" : "text-base-content/60",
											)}
										>
											{thread.lastMessage.from.name ||
												thread.lastMessage.from.address}
										</div>
										<div
											className={clsx(
												"mx-px text-xs whitespace-nowrap",
												thread.unseenCount ? "" : "text-base-content/50",
											)}
										>
											{formatInboxDate(thread.lastMessage.createdAt)}
										</div>
									</div>
									<div className="flex min-h-6 items-center justify-between gap-3">
										<div
											className={clsx(
												"line-clamp-1 min-w-0",
												thread.unseenCount > 0
													? "font-semibold"
													: "text-base-content/60",
											)}
										>
											<ThreadTitle thread={thread} />
										</div>
										<div className="flex shrink-0 items-center gap-1">
											{thread.unseenCount ? (
												<div className="badge badge-primary">
													{thread.unseenCount}
												</div>
											) : null}
											<button
												type="button"
												className="btn hidden btn-ghost btn-xs group-hover:inline-flex"
												aria-label="Thread options"
												onClick={(event) => {
													event.preventDefault();
												}}
											>
												<CaretDownIcon className="size-5.5" />
											</button>
										</div>
									</div>
								</div>
							</Link>
						);
					})}
					{hasNext ? (
						<div className="px-5 pb-1">
							<button
								type="button"
								className="btn w-full"
								disabled={isLoadingNext}
								onClick={() => {
									loadNext(PAGE_SIZE);
								}}
							>
								Load more
								<span
									className={clsx(
										"loading loading-md loading-spinner",
										isLoadingNext ? "visible" : "invisible",
									)}
								></span>
							</button>
						</div>
					) : null}
				</div>
			</div>
			<div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
				<Outlet />
			</div>
		</div>
	);
}

function EmailLayoutSkeleton() {
	return (
		<div className="flex h-full min-h-0 flex-col lg:flex-row">
			<div className="flex min-h-72 w-full flex-col gap-3 border-b px-5 py-3 lg:h-full lg:w-[50%] lg:max-w-[50%] lg:min-w-88 lg:border-r lg:border-b-0">
				<div className="flex items-center justify-between">
					<div className="skeleton h-8 w-24"></div>
					<div className="skeleton h-10 w-28"></div>
				</div>
				<div className="flex flex-1 flex-col gap-3 overflow-hidden">
					{Array.from({ length: 6 }).map((_, index) => {
						return (
							<div key={index} className="flex items-center gap-3 py-2">
								<div className="skeleton size-12 shrink-0"></div>
								<div className="flex min-w-0 flex-1 flex-col gap-2">
									<div className="skeleton h-4 w-3/5"></div>
									<div className="skeleton h-5 w-4/5"></div>
								</div>
							</div>
						);
					})}
				</div>
			</div>
			<div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-5">
				<div className="skeleton h-full w-full"></div>
			</div>
		</div>
	);
}
