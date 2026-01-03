import type { IconProps } from "@lucide/svelte";
import BookOpenIcon from "@lucide/svelte/icons/book-open";
import CalendarIcon from "@lucide/svelte/icons/calendar";
import FileIcon from "@lucide/svelte/icons/file";
import FileArchiveIcon from "@lucide/svelte/icons/file-archive";
import FileTextIcon from "@lucide/svelte/icons/file-text";
import ImagesIcon from "@lucide/svelte/icons/images";
import PresentationIcon from "@lucide/svelte/icons/presentation";
import ReceiptTextIcon from "@lucide/svelte/icons/receipt-text";
import StarIcon from "@lucide/svelte/icons/star";
import TableIcon from "@lucide/svelte/icons/table";
import TrashIcon from "@lucide/svelte/icons/trash-2";
import VideoIcon from "@lucide/svelte/icons/video";
import type { Component } from "svelte";

import type { AttachmentType, MailboxType } from "./graphql/generated/graphql";

export const TARGET_MAILBOXES: Array<{
	name: string;
	type: MailboxType;
	icon: Component<IconProps, {}, "">;
}> = [
	{
		name: "Important",
		type: "important",
		icon: StarIcon,
	},
	{
		name: "News",
		type: "news",
		icon: BookOpenIcon,
	},
	{
		name: "Transactional",
		type: "transactional",
		icon: ReceiptTextIcon,
	},
	{
		name: "Trash",
		type: "trash",
		icon: TrashIcon,
	},
];

export const ATTACHMENT_TYPE_TO_ICONS: Record<
	AttachmentType,
	{
		name: string;
		type: AttachmentType;
		icon: Component<IconProps, {}, "">;
	}
> = {
	CalendarInvite: {
		name: "Calendar Invite",
		type: "CalendarInvite",
		icon: CalendarIcon,
	},
	Document: {
		name: "Document",
		type: "Document",
		icon: FileTextIcon,
	},
	Image: {
		name: "Image",
		type: "Image",
		icon: ImagesIcon,
	},
	Media: {
		name: "Media",
		type: "Media",
		icon: VideoIcon,
	},
	Other: {
		name: "Other",
		type: "Other",
		icon: FileIcon,
	},
	PDF: {
		name: "PDF",
		type: "PDF",
		icon: FileTextIcon,
	},
	Presentation: {
		name: "Presentation",
		type: "Presentation",
		icon: PresentationIcon,
	},
	Spreadsheet: {
		name: "Spreadsheet",
		type: "Spreadsheet",
		icon: TableIcon,
	},
	ZIP: {
		name: "ZIP",
		type: "ZIP",
		icon: FileArchiveIcon,
	},
};

export const ATTACHMENT_TYPES: Array<{
	name: string;
	type: AttachmentType;
	icon: Component<IconProps, {}, "">;
}> = Object.values(ATTACHMENT_TYPE_TO_ICONS);
