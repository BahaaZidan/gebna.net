import { CalendarDotIcon } from "@phosphor-icons/react/dist/ssr/CalendarDot";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { FileIcon } from "@phosphor-icons/react/dist/ssr/File";
import { FileArchiveIcon } from "@phosphor-icons/react/dist/ssr/FileArchive";
import { FilePdfIcon } from "@phosphor-icons/react/dist/ssr/FilePdf";
import { GridNineIcon } from "@phosphor-icons/react/dist/ssr/GridNine";
import { ImageIcon } from "@phosphor-icons/react/dist/ssr/Image";
import { MicrosoftWordLogoIcon } from "@phosphor-icons/react/dist/ssr/MicrosoftWordLogo";
import { PresentationChartIcon } from "@phosphor-icons/react/dist/ssr/PresentationChart";
import { ProhibitIcon } from "@phosphor-icons/react/dist/ssr/Prohibit";
import { VideoIcon } from "@phosphor-icons/react/dist/ssr/Video";
import { WaveformIcon } from "@phosphor-icons/react/dist/ssr/Waveform";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import clsx from "clsx";
import { useEffect, useRef } from "react";
import { graphql, useFragment } from "react-relay";

import type { componentsAttachmentListItem$key } from "./__generated__/componentsAttachmentListItem.graphql";
import type { componentsMessageBubble$key } from "./__generated__/componentsMessageBubble.graphql";
import type { componentsThreadListItem$key } from "./__generated__/componentsThreadListItem.graphql";
import type { componentsThreadTitle$key } from "./__generated__/componentsThreadTitle.graphql";
import { formatInboxDate } from "./format";

function formatSizeInBytes(sizeInBytes: number): string {
	if (sizeInBytes < 1024) return `${sizeInBytes} B`;

	const kib = sizeInBytes / 1024;
	if (kib < 1024) return `${roundTo2(kib)} KB`;

	return `${roundTo2(kib / 1024)} MB`;
}

function roundTo2(value: number): string {
	return `${Math.round(value * 100) / 100}`;
}

export function ThreadTitle({
	thread,
	className,
}: {
	thread: componentsThreadTitle$key;
	className?: string;
}) {
	const data = useFragment(
		graphql`
			fragment componentsThreadTitle on EmailThread {
				id
				title
				participants {
					id
					isSelf
					name
				}
			}
		`,
		thread,
	);
	const otherParticipants = data.participants.filter((participant) => {
		return !participant.isSelf;
	});

	return (
		<span className={clsx("wrap-anywhere", className)}>
			{data.title ||
				otherParticipants.map((participant) => participant.name).join(", ") ||
				"Untitled thread"}
		</span>
	);
}

export function ThreadListItem(props: {
	thread: componentsThreadListItem$key;
}) {
	const thread = useFragment(
		graphql`
			fragment componentsThreadListItem on EmailThread {
				id
				...componentsThreadTitle
				unseenCount
				avatar
				title
				participants {
					id
					avatar
					isSelf
					name
					address
					isBlocked
				}
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
		`,
		props.thread,
	);
	const router = useRouter();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const threadPath = router.buildLocation({
		to: "/app/email/$thread_id",
		params: { thread_id: thread.id },
	}).pathname;
	const isActive =
		pathname === threadPath || pathname.startsWith(`${threadPath}/`);

	const otherParticipants = thread.participants.filter((participant) => {
		return !participant.isSelf;
	});
	const avatar = thread.avatar ?? otherParticipants[0]?.avatar;
	const alt =
		thread.title ||
		otherParticipants.map((participant) => participant.name).join(", ") ||
		"Email thread";

	return (
		<Link
			key={thread.id}
			to="/app/email/$thread_id"
			params={{ thread_id: thread.id }}
			className={clsx(
				"group flex w-full items-center gap-3 px-5 py-3 hover:bg-base-200",
				isActive ? "bg-base-300" : null,
			)}
		>
			<div className="indicator">
				<span
					className={clsx(
						"indicator-item badge badge-primary px-1 py-2 badge-xs indicator-start",
						otherParticipants[0].isBlocked ? "visible" : "invisible",
					)}
				>
					<ProhibitIcon className="size-4" />
				</span>
				<img
					src={avatar}
					alt={`${alt} avatar`}
					className="rounded-box object-contain size-12 min-h-12 min-w-12 bg-accent-content"
				/>
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<div className="flex items-baseline justify-between gap-3">
					<div
						className={clsx(
							"line-clamp-1 min-w-0 text-sm",
							thread.unseenCount > 0 ? "" : "text-base-content/60",
						)}
					>
						{thread.lastMessage.from.name || thread.lastMessage.from.address}
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
							thread.unseenCount > 0 ? "font-semibold" : "text-base-content/60",
						)}
					>
						<ThreadTitle thread={thread} />
					</div>
					<div className="flex shrink-0 items-center gap-1">
						{thread.unseenCount ? (
							<div className="badge badge-primary">{thread.unseenCount}</div>
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
}

export function MessageBubble({
	message,
	onOpenSender,
}: {
	message: componentsMessageBubble$key;
	onOpenSender?: (senderId: string) => void;
}) {
	const data = useFragment(
		graphql`
			fragment componentsMessageBubble on EmailMessage {
				id
				html
				plaintext
				createdAt
				from {
					id
					isSelf
					isBlocked
					name
					avatar
					address
				}
				to {
					id
					isSelf
					address
				}
				attachments {
					...componentsAttachmentListItem
				}
			}
		`,
		message,
	);
	const senderName = data.from.name || data.from.address;

	return (
		<div className="flex w-full items-start gap-4 p-3">
			<div className="shrink-0">
				<button
					type="button"
					className="indicator cursor-pointer appearance-none border-0 bg-transparent p-0"
					onClick={() => onOpenSender?.(data.from.id)}
					aria-label={`View sender details for ${senderName}`}
				>
					<span
						className={clsx(
							"indicator-item badge badge-primary px-1 py-2 mx-1 badge-xs indicator-start",
							data.from.isBlocked ? "visible" : "invisible",
						)}
					>
						<ProhibitIcon className="size-4" />
					</span>
					<img
						alt={`${senderName} avatar`}
						src={data.from.avatar}
						className="size-12 bg-accent-content object-cover"
					/>
				</button>
			</div>
			<div className="flex w-full min-w-0 flex-col">
				<div className="mb-0.5 flex flex-wrap items-baseline justify-between gap-2">
					<button
						type="button"
						className="min-w-0 cursor-pointer appearance-none border-0 bg-transparent p-0 text-left font-bold"
						onClick={() => onOpenSender?.(data.from.id)}
						aria-label={`View sender details for ${senderName}`}
					>
						{senderName}{" "}
						<span className="text-sm font-normal text-base-content/50">
							&lt;{data.from.address}&gt;
						</span>
					</button>
					<time className="text-xs text-base-content/60">
						{formatInboxDate(data.createdAt)}
					</time>
				</div>
				{!data.to.isSelf && <div>to {data.to.address}</div>}
				{data.plaintext ? (
					<pre className="font-sans text-sm leading-6 whitespace-pre-wrap text-base-content">
						{data.plaintext}
					</pre>
				) : data.html ? (
					<EmailHtml html={data.html} />
				) : null}
				{data.attachments.length ? (
					<div className="flex flex-wrap gap-2">
						{data.attachments.map((a) => (
							<AttachmentListItem attachment={a} />
						))}
					</div>
				) : null}
			</div>
		</div>
	);
}

function renderAttachmentIcon(category: string) {
	switch (category) {
		case "Archive":
			return <FileArchiveIcon className="size-12" />;
		case "Audio":
			return <WaveformIcon className="size-12" />;
		case "Video":
			return <VideoIcon className="size-12" />;
		case "PDF":
			return <FilePdfIcon className="size-12" />;
		case "Word":
			return <MicrosoftWordLogoIcon className="size-12" />;
		case "Slides":
			return <PresentationChartIcon className="size-12" />;
		case "Excel":
			return <GridNineIcon className="size-12" />;
		case "Image":
			return <ImageIcon className="size-12" />;
		case "Calendar":
			return <CalendarDotIcon className="size-12" />;
		default:
			return <FileIcon className="size-12" />;
	}
}

function EmailHtml({ html }: { html: string }) {
	const hostRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;

		const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: "open" });
		shadowRoot.innerHTML = html;

		return () => {
			shadowRoot.replaceChildren();
		};
	}, [html]);

	return <div ref={hostRef} className="w-full overflow-hidden" />;
}

export function AttachmentListItem(props: {
	attachment: componentsAttachmentListItem$key;
}) {
	const attachment = useFragment(
		graphql`
			fragment componentsAttachmentListItem on EmailAttachment {
				id
				filename
				sizeInBytes
				description
				category
				url
			}
		`,
		props.attachment,
	);

	const size =
		typeof attachment.sizeInBytes === "number"
			? formatSizeInBytes(attachment.sizeInBytes)
			: null;

	return (
		<a
			key={attachment.id}
			href={attachment.url ?? undefined}
			download={attachment.filename ?? undefined}
			className="flex min-w-56 max-w-full items-center gap-3 rounded-box bg-base-200 px-4 py-3 transition-colors hover:bg-base-300"
		>
			<div className="shrink-0 text-base-content/70">
				{renderAttachmentIcon(attachment.category)}
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<div className="line-clamp-1 font-medium">
					{attachment.filename || "Attachment"}
				</div>
				<div className="line-clamp-2 text-sm text-base-content/70">
					{attachment.description || size || "Download file"}
				</div>
			</div>
		</a>
	);
}
