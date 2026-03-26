import { CheckIcon } from "@phosphor-icons/react/dist/ssr/Check";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/ssr/PencilSimple";
import { ProhibitIcon } from "@phosphor-icons/react/dist/ssr/Prohibit";
import { WarningIcon } from "@phosphor-icons/react/dist/ssr/Warning";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import { createFileRoute, Link, useHydrated } from "@tanstack/react-router";
import { Suspense, useEffect, useState } from "react";
import {
	graphql,
	useLazyLoadQuery,
	useMutation,
	usePaginationFragment,
} from "react-relay";

import { LoadNextButton } from "#/lib/components";
import { AttachmentListItem, ThreadListItem } from "#/lib/email/components";
import { buildPageMeta } from "#/lib/utils/seo";

import type { ThreadIdSenderDetailsActionsMutation } from "./__generated__/ThreadIdSenderDetailsActionsMutation.graphql";
import type { ThreadIdSenderDetailsAttachmentsSection$key } from "./__generated__/ThreadIdSenderDetailsAttachmentsSection.graphql";
import type { ThreadIdSenderDetailsNameMutation } from "./__generated__/ThreadIdSenderDetailsNameMutation.graphql";
import type {
	ThreadIdSenderDetailsQuery,
	ThreadIdSenderDetailsQuery$data,
} from "./__generated__/ThreadIdSenderDetailsQuery.graphql";
import type { ThreadIdSenderDetailsThreadsSection$key } from "./__generated__/ThreadIdSenderDetailsThreadsSection.graphql";

export const Route = createFileRoute(
	"/_app/app/email/$thread_id/sender/$sender_id",
)({
	component: RouteComponent,
	head: () => ({
		meta: buildPageMeta({
			title: "Sender Details",
			description: "gebna sender details.",
			robots: "noindex, nofollow",
		}),
	}),
});

type Sender = Exclude<
	NonNullable<ThreadIdSenderDetailsQuery$data["node"]>,
	{ readonly __typename: "%other" }
>;

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
			query ThreadIdSenderDetailsQuery(
				$id: ID!
				$firstAttachments: Int!
				$firstThreads: Int!
			) {
				node(id: $id) {
					__typename
					... on EmailAddressRef {
						id
						name
						avatar
						address
						isBlocked
						isSpam
						...ThreadIdSenderDetailsAttachmentsSection
							@arguments(first: $firstAttachments)
						...ThreadIdSenderDetailsThreadsSection
							@arguments(first: $firstThreads)
					}
				}
			}
		`,
		{ id: sender_id, firstAttachments: 10, firstThreads: 10 },
		{ fetchPolicy: "store-or-network" },
	);

	if (!data.node || data.node.__typename !== "EmailAddressRef") {
		return (
			<div className="flex h-full min-h-0 items-center justify-center p-6">
				<div className="text-sm text-base-content/60">Sender not found.</div>
			</div>
		);
	}

	const { thread_id } = Route.useParams();
	const sender = data.node;
	const [isEditingName, setIsEditingName] = useState(false);
	const [draftName, setDraftName] = useState(sender.name);
	const [commitUpdateName, isSavingName] =
		useMutation<ThreadIdSenderDetailsNameMutation>(graphql`
			mutation ThreadIdSenderDetailsNameMutation(
				$input: UpdateEmailAddressRefInput!
			) {
				updateEmailAddressRef(input: $input) {
					result {
						id
						name
					}
				}
			}
		`);

	useEffect(() => {
		if (!isEditingName) {
			setDraftName(sender.name);
		}
	}, [isEditingName, sender.name]);

	const trimmedDraftName = draftName.trim();

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
						{isEditingName ? (
							<form
								className="flex flex-col items-center gap-3"
								onSubmit={(event) => {
									event.preventDefault();
									if (!trimmedDraftName || trimmedDraftName === sender.name) {
										setIsEditingName(false);
										return;
									}

									commitUpdateName({
										variables: {
											input: {
												address: sender.address,
												givenName: trimmedDraftName,
											},
										},
										optimisticResponse: {
											updateEmailAddressRef: {
												result: {
													id: sender.id,
													name: trimmedDraftName,
												},
											},
										},
										onCompleted: () => {
											setIsEditingName(false);
										},
									});
								}}
							>
								<label className="w-full max-w-xs">
									<span className="sr-only">Address name</span>
									<input
										autoFocus
										value={draftName}
										onChange={(event) => {
											setDraftName(event.target.value);
										}}
										className="input input-bordered w-full text-center"
										maxLength={30}
									/>
								</label>
								<div className="flex items-center gap-2">
									<button
										type="submit"
										className="btn btn-primary btn-sm"
										disabled={
											isSavingName ||
											!trimmedDraftName ||
											trimmedDraftName === sender.name
										}
									>
										<CheckIcon className="size-4" />
										Save
									</button>
									<button
										type="button"
										className="btn btn-ghost btn-sm"
										disabled={isSavingName}
										onClick={() => {
											setDraftName(sender.name);
											setIsEditingName(false);
										}}
									>
										<XIcon className="size-4" />
										Cancel
									</button>
								</div>
							</form>
						) : (
							<div className="flex flex-col items-center gap-2">
								<div className="group relative flex w-full max-w-xs items-center justify-center">
									<div className="truncate px-8 text-center text-xl font-semibold">
										{sender.name}
									</div>
									<button
										type="button"
										className="btn btn-ghost btn-xs absolute right-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
										aria-label="Edit address name"
										onClick={() => {
											setDraftName(sender.name);
											setIsEditingName(true);
										}}
									>
										<PencilSimpleIcon className="size-4" />
									</button>
								</div>
								<div className="truncate text-sm text-base-content/60">
									{sender.address}
								</div>
							</div>
						)}
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
				<SenderAttachmentsSection sender={sender} />
				<SenderThreadsSection sender={sender} />
				<SenderActionsSection sender={sender} />
			</div>
		</div>
	);
}

function SenderActionsSection({ sender }: { sender: Sender }) {
	const [commitUpdate, isInFlight] =
		useMutation<ThreadIdSenderDetailsActionsMutation>(graphql`
			mutation ThreadIdSenderDetailsActionsMutation(
				$input: UpdateEmailAddressRefInput!
			) {
				updateEmailAddressRef(input: $input) {
					result {
						id
						address
						isBlocked
						isSpam
					}
				}
			}
		`);

	return (
		<section className="flex flex-col gap-4">
			<div>
				<h2 className="text-xs font-medium uppercase tracking-[0.2em] text-base-content/50">
					Actions
				</h2>
				<p className="mt-1 text-sm text-base-content/60">
					Manage how future messages from this address are handled.
				</p>
			</div>
			<div className="grid gap-3">
				<button
					type="button"
					className="btn justify-start"
					disabled={isInFlight}
					onClick={() => {
						const nextBlocked = !sender.isBlocked;
						commitUpdate({
							variables: {
								input: {
									address: sender.address,
									isBlocked: nextBlocked,
									isSpam: sender.isSpam,
								},
							},
							optimisticResponse: {
								updateEmailAddressRef: {
									result: {
										id: sender.id,
										address: sender.address,
										isBlocked: nextBlocked,
										isSpam: sender.isSpam,
									},
								},
							},
						});
					}}
				>
					<ProhibitIcon className="size-5" />
					{sender.isBlocked ? "Unblock sender" : "Block sender"}
				</button>
				<button
					type="button"
					className="btn btn-error btn-outline justify-start"
					disabled={isInFlight}
					onClick={() => {
						const nextSpam = !sender.isSpam;
						const nextBlocked = nextSpam ? true : false;
						commitUpdate({
							variables: {
								input: {
									address: sender.address,
									isBlocked: nextBlocked,
									isSpam: nextSpam,
								},
							},
							optimisticResponse: {
								updateEmailAddressRef: {
									result: {
										id: sender.id,
										address: sender.address,
										isBlocked: nextBlocked,
										isSpam: nextSpam,
									},
								},
							},
						});
					}}
				>
					<WarningIcon className="size-5" />
					{sender.isSpam ? "Unreport sender" : "Report and block"}
				</button>
			</div>
		</section>
	);
}

function SenderAttachmentsSection({
	sender,
}: {
	sender: ThreadIdSenderDetailsAttachmentsSection$key;
}) {
	const { data, hasNext, isLoadingNext, loadNext } = usePaginationFragment(
		graphql`
			fragment ThreadIdSenderDetailsAttachmentsSection on EmailAddressRef
			@argumentDefinitions(
				first: { type: "Int", defaultValue: 10 }
				after: { type: "String" }
			)
			@refetchable(
				queryName: "ThreadIdSenderDetailsAttachmentsSectionPaginationQuery"
			) {
				attachments(first: $first, after: $after)
					@connection(
						key: "ThreadIdSenderDetailsAttachmentsSection_attachments"
					) {
					edges {
						node {
							id
							...componentsAttachmentListItem
						}
					}
					pageInfo {
						hasNextPage
					}
				}
			}
		`,
		sender,
	);

	return (
		<section className="flex flex-col gap-4">
			<div>
				<h2 className="text-xs font-medium uppercase tracking-[0.2em] text-base-content/50">
					Attachments
				</h2>
				<p className="mt-1 text-sm text-base-content/60">
					Files sent by this address.
				</p>
			</div>
			{data.attachments.edges.length ? (
				<div className="flex flex-col gap-2">
					{data.attachments.edges.map((edge) => (
						<AttachmentListItem key={edge.node.id} attachment={edge.node} />
					))}
				</div>
			) : (
				<div className="rounded-box border border-dashed border-base-300 p-4 text-sm text-base-content/60">
					No attachments from this sender yet.
				</div>
			)}
			<LoadNextButton
				hasNext={hasNext}
				isLoadingNext={isLoadingNext}
				onClick={() => {
					loadNext(10);
				}}
			/>
		</section>
	);
}

function SenderThreadsSection({
	sender,
}: {
	sender: ThreadIdSenderDetailsThreadsSection$key;
}) {
	const { data, hasNext, isLoadingNext, loadNext } = usePaginationFragment(
		graphql`
			fragment ThreadIdSenderDetailsThreadsSection on EmailAddressRef
			@argumentDefinitions(
				first: { type: "Int", defaultValue: 10 }
				after: { type: "String" }
			)
			@refetchable(
				queryName: "ThreadIdSenderDetailsThreadsSectionPaginationQuery"
			) {
				threads(first: $first, after: $after)
					@connection(key: "ThreadIdSenderDetailsThreadsSection_threads") {
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
		sender,
	);

	return (
		<section className="flex flex-col gap-4">
			<div>
				<h2 className="text-xs font-medium uppercase tracking-[0.2em] text-base-content/50">
					Threads
				</h2>
				<p className="mt-1 text-sm text-base-content/60">
					Conversations this address participated in.
				</p>
			</div>
			{data.threads.edges.length ? (
				<div className="overflow-hidden rounded-box border border-base-300 bg-base-100">
					{data.threads.edges.map((edge) => (
						<ThreadListItem key={edge.node.id} thread={edge.node} />
					))}
				</div>
			) : (
				<div className="rounded-box border border-dashed border-base-300 p-4 text-sm text-base-content/60">
					No threads for this sender yet.
				</div>
			)}
			<LoadNextButton
				hasNext={hasNext}
				isLoadingNext={isLoadingNext}
				onClick={() => {
					loadNext(10);
				}}
			/>
		</section>
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
