import { CalendarDotIcon } from "@phosphor-icons/react/dist/ssr/CalendarDot";
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
import clsx from "clsx";
import { useEffect, useRef } from "react";
import { graphql, useFragment } from "react-relay";

import type { componentsMessageBubble$key } from "./__generated__/componentsMessageBubble.graphql";
import type { componentsThreadAvatar$key } from "./__generated__/componentsThreadAvatar.graphql";
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

export function ThreadAvatar({
	thread,
	className,
}: {
	thread: componentsThreadAvatar$key;
	className?: string;
}) {
	const data = useFragment(
		graphql`
			fragment componentsThreadAvatar on EmailThread {
				id
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
			}
		`,
		thread,
	);
	const otherParticipants = data.participants.filter((participant) => {
		return !participant.isSelf;
	});
	const avatar = data.avatar ?? otherParticipants[0]?.avatar;
	const alt =
		data.title ||
		otherParticipants.map((participant) => participant.name).join(", ") ||
		"Email thread";

	return (
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
				className={clsx("rounded-box object-contain", className)}
			/>
		</div>
	);
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

export function MessageBubble({
	message,
}: {
	message: componentsMessageBubble$key;
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
					name
					avatar
					address
				}
				attachments {
					id
					filename
					sizeInBytes
					description
					category
					url
				}
			}
		`,
		message,
	);
	const senderName = data.from.name || data.from.address;

	return (
		<div className="flex w-full items-start gap-4 p-3">
			<div className="shrink-0">
				<img
					alt={`${senderName} avatar`}
					src={data.from.avatar}
					className="size-12 bg-accent-content object-cover"
				/>
			</div>
			<div className="flex w-full min-w-0 flex-col gap-3">
				<div className="flex flex-wrap items-baseline gap-2">
					<div className="font-bold">{senderName}</div>
					<time className="text-xs text-base-content/60">
						{formatInboxDate(data.createdAt)}
					</time>
				</div>
				{data.plaintext ? (
					<pre className="font-sans text-sm leading-6 whitespace-pre-wrap text-base-content">
						{data.plaintext}
					</pre>
				) : data.html ? (
					<EmailHtml html={data.html} />
				) : null}
				{data.attachments.length ? (
					<div className="flex flex-wrap gap-2">
						{data.attachments.map((attachment) => {
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
						})}
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
