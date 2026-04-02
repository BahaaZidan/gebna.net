import { NotePencilIcon } from "@phosphor-icons/react/dist/ssr/NotePencil";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import { createFileRoute, Outlet, useHydrated } from "@tanstack/react-router";
import { Suspense, useEffect, useState } from "react";
import {
	graphql,
	useLazyLoadQuery,
	useMutation,
	usePaginationFragment,
} from "react-relay";

import { LoadNextButton } from "#/lib/components";
import { ThreadListItem } from "#/lib/email/components";
import { buildPageMeta } from "#/lib/utils/seo";

import type { routePaginationQuery } from "./__generated__/routePaginationQuery.graphql";
import type { routeQuery } from "./__generated__/routeQuery.graphql";
import type { routeSendEmailMessageMutation } from "./__generated__/routeSendEmailMessageMutation.graphql";
import type { routeViewer$key } from "./__generated__/routeViewer.graphql";

export const Route = createFileRoute("/_app/app/email")({
	component: RouteComponent,
	head: () => ({
		meta: buildPageMeta({
			title: "Inbox",
			description: "gebna inbox.",
			robots: "noindex, nofollow",
		}),
	}),
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
	const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
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
		<>
			<div className="flex h-full min-h-0 flex-col lg:flex-row">
				<div className="flex min-h-72 w-full flex-col gap-1 border-b py-3 lg:h-full lg:w-[50%] lg:max-w-[50%] lg:min-w-88 lg:border-r lg:border-b-0">
					<div className="flex items-center justify-between px-5">
						<h1 className="font-mono text-2xl font-bold">gebna</h1>
						<div className="tooltip tooltip-bottom" data-tip="New Mail">
							<button
								type="button"
								className="btn btn-ghost p-2"
								aria-label="New Mail"
								onClick={() => {
									setIsComposeModalOpen(true);
								}}
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
			<ComposeEmailModal
				isOpen={isComposeModalOpen}
				onClose={() => {
					setIsComposeModalOpen(false);
				}}
			/>
		</>
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

function ComposeEmailModal({
	isOpen,
	onClose,
}: {
	isOpen: boolean;
	onClose: () => void;
}) {
	const [to, setTo] = useState("");
	const [subject, setSubject] = useState("");
	const [body, setBody] = useState("");
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [commitSendEmailMessage, isSending] =
		useMutation<routeSendEmailMessageMutation>(graphql`
			mutation routeSendEmailMessageMutation(
				$bodyInMarkdown: String!
				$subject: String!
				$to: String!
			) {
				sendEmailMessage(
					input: {
						bodyInMarkdown: $bodyInMarkdown
						subject: $subject
						recipients: { to: [$to] }
					}
				) {
					result
				}
			}
		`);
	const trimmedTo = to.trim();
	const trimmedSubject = subject.trim();
	const trimmedBody = body.trim();
	const canSubmit = !!trimmedTo && !!trimmedSubject && !!trimmedBody && !isSending;

	function handleClose() {
		if (isSending) return;

		setSubmitError(null);
		setTo("");
		setSubject("");
		setBody("");
		onClose();
	}

	useEffect(() => {
		if (!isOpen) return;

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key !== "Escape" || isSending) return;

			setSubmitError(null);
			setTo("");
			setSubject("");
			setBody("");
			onClose();
		}

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen, isSending, onClose]);

	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="compose-email-title"
				className="w-full max-w-2xl rounded-box border border-base-300 bg-base-100 shadow-2xl"
			>
				<div className="flex items-start justify-between gap-4 border-b border-base-300 p-5">
					<div>
						<h2 id="compose-email-title" className="text-xl font-semibold">
							New mail
						</h2>
						<p className="mt-1 text-sm text-base-content/60">
							Send a plaintext email from your account.
						</p>
					</div>
					<button
						type="button"
						className="btn btn-ghost btn-sm btn-circle"
						aria-label="Close new mail form"
						onClick={handleClose}
						disabled={isSending}
					>
						<XIcon className="size-5" />
					</button>
				</div>
				<form
					className="flex flex-col gap-4 p-5"
					onSubmit={(event) => {
						event.preventDefault();
						if (!canSubmit) return;

						setSubmitError(null);
						commitSendEmailMessage({
							variables: {
								bodyInMarkdown: body,
								subject,
								to,
							},
							onCompleted: (response, errors) => {
								if (errors?.length || !response.sendEmailMessage?.result) {
									setSubmitError(
										errors?.[0]?.message ||
											"Something went wrong while sending the email.",
									);
									return;
								}

								handleClose();
							},
							onError: (error) => {
								setSubmitError(error.message);
							},
						});
					}}
				>
					<label className="flex flex-col gap-2">
						<span className="text-sm font-medium">To</span>
						<input
							type="email"
							required
							autoFocus
							value={to}
							onChange={(event) => {
								setSubmitError(null);
								setTo(event.target.value);
							}}
							placeholder="name@example.com"
							className="input input-bordered w-full"
							disabled={isSending}
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-sm font-medium">Subject</span>
						<input
							type="text"
							required
							value={subject}
							onChange={(event) => {
								setSubmitError(null);
								setSubject(event.target.value);
							}}
							placeholder="Subject"
							className="input input-bordered w-full"
							disabled={isSending}
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-sm font-medium">Message</span>
						<textarea
							required
							rows={10}
							value={body}
							onChange={(event) => {
								setSubmitError(null);
								setBody(event.target.value);
							}}
							placeholder="Write your message..."
							className="textarea textarea-bordered min-h-52 w-full"
							disabled={isSending}
						/>
					</label>
					{submitError ? (
						<p className="text-sm text-error">{submitError}</p>
					) : null}
					<div className="flex items-center justify-end gap-3 border-t border-base-300 pt-4">
						<button
							type="button"
							className="btn btn-ghost"
							onClick={handleClose}
							disabled={isSending}
						>
							Cancel
						</button>
						<button type="submit" className="btn btn-primary" disabled={!canSubmit}>
							{isSending ? "Sending..." : "Send email"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
