import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import { createFileRoute, Link, useHydrated } from "@tanstack/react-router";
import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import type { ThreadIdSenderDetailsQuery } from "./__generated__/ThreadIdSenderDetailsQuery.graphql";

export const Route = createFileRoute(
	"/_app/app/email/$thread_id/sender/$sender_id",
)({
	component: RouteComponent,
});

function RouteComponent() {
	const hydrated = useHydrated();

	if (!hydrated) {
		return <SenderDetailsSkeleton />;
	}

	return (
		<Suspense fallback={<SenderDetailsSkeleton />}>
			<SenderDetailsQueryBoundary />
		</Suspense>
	);
}

function SenderDetailsQueryBoundary() {
	const { sender_id } = Route.useParams();
	const data = useLazyLoadQuery<ThreadIdSenderDetailsQuery>(
		graphql`
			query ThreadIdSenderDetailsQuery($id: ID!) {
				node(id: $id) {
					__typename
					... on EmailAddressRef {
						id
						name
						avatar
						address
						isBlocked
					}
				}
			}
		`,
		{ id: sender_id },
		{ fetchPolicy: "store-or-network" },
	);

	if (!data.node || data.node.__typename !== "EmailAddressRef") {
		return (
			<div className="flex h-full min-h-0 items-center justify-center p-6">
				<div className="text-sm text-base-content/60">Sender not found.</div>
			</div>
		);
	}

	return <SenderDetailsContent sender={data.node} />;
}

function SenderDetailsContent({
	sender,
}: {
	sender: {
		name: string;
		avatar: string;
		address: string;
		isBlocked: boolean;
	};
}) {
	const { thread_id } = Route.useParams();

	return (
		<div className="flex h-full min-h-0 flex-col bg-base-100">
			<div className="flex shrink-0 items-center gap-2 p-3">
				<Link
					to="/app/email/$thread_id"
					params={{ thread_id }}
					className="btn btn-ghost btn-sm"
					aria-label="Back to thread"
				>
					<XIcon className="size-5" />
				</Link>
				<div className="min-w-0">
					<div className="truncate text-lg">Address info</div>
				</div>
			</div>
			<div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
				<div className="flex flex-col items-center gap-4 border-b border-base-300 pb-6 text-center">
					<img
						src={sender.avatar}
						alt={`${sender.name} avatar`}
						className="size-24 rounded-box bg-accent-content object-cover"
					/>
					<div className="min-w-0">
						<div className="truncate text-xl font-semibold">{sender.name}</div>
						<div className="truncate text-sm text-base-content/60">
							{sender.address}
						</div>
					</div>
				</div>
				<div className="rounded-box border border-base-300 bg-base-200/60 p-4">
					<div className="text-xs font-medium uppercase tracking-[0.2em] text-base-content/50">
						Blocked
					</div>
					<div className="mt-2 flex items-center gap-2 text-sm font-medium">
						<span
							className={
								sender.isBlocked
									? "inline-block size-2 rounded-full bg-error"
									: "inline-block size-2 rounded-full bg-success"
							}
						/>
						{sender.isBlocked ? "Blocked sender" : "Not blocked"}
					</div>
				</div>
			</div>
		</div>
	);
}

function SenderDetailsSkeleton() {
	return (
		<div className="flex h-full min-h-0 flex-col p-3">
			<div className="skeleton mb-3 h-12 w-40 shrink-0"></div>
			<div className="flex flex-1 flex-col gap-4">
				<div className="skeleton h-40 w-full"></div>
				<div className="skeleton h-28 w-full"></div>
			</div>
		</div>
	);
}
