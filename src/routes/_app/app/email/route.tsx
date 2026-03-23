import { NotePencilIcon } from "@phosphor-icons/react/dist/ssr/NotePencil";
import { createFileRoute, Outlet, useHydrated } from "@tanstack/react-router";
import { Suspense } from "react";
import { graphql, useLazyLoadQuery, usePaginationFragment } from "react-relay";

import { LoadNextButton } from "#/lib/components";
import { ThreadListItem } from "#/lib/email/components";

import type { routePaginationQuery } from "./__generated__/routePaginationQuery.graphql";
import type { routeQuery } from "./__generated__/routeQuery.graphql";
import type { routeViewer$key } from "./__generated__/routeViewer.graphql";

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
							...componentsThreadListItem
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
					{data.emailThreads.edges.map(({ node }) => (
						<ThreadListItem thread={node} />
					))}
					<LoadNextButton
						hasNext={hasNext}
						isLoadingNext={isLoadingNext}
						onClick={() => {
							loadNext(PAGE_SIZE);
						}}
					/>
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
