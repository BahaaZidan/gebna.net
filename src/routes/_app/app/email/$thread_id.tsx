import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { Suspense, useEffect } from "react";
import {
	graphql,
	useLazyLoadQuery,
	useMutation,
	usePaginationFragment,
} from "react-relay";

import { MessageBubble, ThreadTitle } from "#/lib/email/components";

import type { ThreadIdPaginationQuery } from "./__generated__/ThreadIdPaginationQuery.graphql";
import type { ThreadIdQuery } from "./__generated__/ThreadIdQuery.graphql";
import type { ThreadIdSeenMutation } from "./__generated__/ThreadIdSeenMutation.graphql";
import type { ThreadIdThread$key } from "./__generated__/ThreadIdThread.graphql";

export const Route = createFileRoute("/_app/app/email/$thread_id")({
	component: RouteComponent,
});

function RouteComponent() {
	const hydrated = useHydrated();

	if (!hydrated) {
		return <EmailThreadSkeleton />;
	}

	return (
		<Suspense fallback={<EmailThreadSkeleton />}>
			<EmailThreadQueryBoundary />
		</Suspense>
	);
}

const PAGE_SIZE = 15;

function EmailThreadQueryBoundary() {
	const { thread_id } = Route.useParams();
	const data = useLazyLoadQuery<ThreadIdQuery>(
		graphql`
			query ThreadIdQuery($id: ID!, $first: Int!, $after: String) {
				node(id: $id) {
					__typename
					... on EmailThread {
						id
						...ThreadIdThread @arguments(first: $first, after: $after)
					}
				}
			}
		`,
		{ id: thread_id, first: PAGE_SIZE },
		{ fetchPolicy: "store-and-network" },
	);

	if (!data.node || data.node.__typename !== "EmailThread") {
		return (
			<div className="flex h-full min-h-0 items-center justify-center p-8">
				<div className="text-sm text-base-content/60">Thread not found.</div>
			</div>
		);
	}

	return <EmailThreadContent thread={data.node} />;
}

function EmailThreadContent({ thread }: { thread: ThreadIdThread$key }) {
	const { data, hasNext, isLoadingNext, loadNext } = usePaginationFragment<
		ThreadIdPaginationQuery,
		ThreadIdThread$key
	>(
		graphql`
			fragment ThreadIdThread on EmailThread
			@argumentDefinitions(
				first: { type: "Int", defaultValue: 15 }
				after: { type: "String" }
			)
			@refetchable(queryName: "ThreadIdPaginationQuery") {
				id
				unseenCount
				...componentsThreadTitle
				messages(first: $first, after: $after)
					@connection(key: "ThreadId_messages") {
					edges {
						node {
							id
							...componentsMessageBubble
						}
					}
					pageInfo {
						hasNextPage
					}
				}
			}
		`,
		thread,
	);
	const [commitSeenMutation] = useMutation<ThreadIdSeenMutation>(graphql`
		mutation ThreadIdSeenMutation($id: ID!) {
			seeEmailThread(id: $id) {
				id
				unseenCount
			}
		}
	`);

	useEffect(() => {
		if (data.unseenCount <= 0) return;

		const timeout = window.setTimeout(() => {
			commitSeenMutation({
				variables: {
					id: data.id,
				},
			});
		}, 2000);

		return () => {
			window.clearTimeout(timeout);
		};
	}, [commitSeenMutation, data.id, data.unseenCount]);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex shrink-0 items-center justify-between border-b p-3">
				<div className="min-w-0 text-lg">
					<ThreadTitle thread={data} />
				</div>
				<button type="button" className="btn btn-ghost btn-sm">
					Options
				</button>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
				{data.messages.edges.map((edge, index) => {
					return (
						<div key={edge.node.id}>
							<MessageBubble message={edge.node} />
							{index + 1 < data.messages.edges.length ? (
								<hr className="border-base-300" />
							) : null}
						</div>
					);
				})}
				{hasNext ? (
					<div className="p-3">
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
								className={`loading loading-md loading-spinner ${
									isLoadingNext ? "visible" : "invisible"
								}`}
							></span>
						</button>
					</div>
				) : null}
			</div>
		</div>
	);
}

function EmailThreadSkeleton() {
	return (
		<div className="flex h-full min-h-0 flex-col p-3">
			<div className="skeleton mb-3 h-12 w-52 shrink-0"></div>
			<div className="flex flex-1 flex-col gap-3 overflow-hidden">
				{Array.from({ length: 4 }).map((_, index) => {
					return <div key={index} className="skeleton h-32 w-full"></div>;
				})}
			</div>
		</div>
	);
}
