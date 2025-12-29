import type { IconProps } from "@lucide/svelte";
import BookOpenIcon from "@lucide/svelte/icons/book-open";
import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
import ImagesIcon from "@lucide/svelte/icons/images";
import LogOutIcon from "@lucide/svelte/icons/log-out";
import PinIcon from "@lucide/svelte/icons/pin";
import ReceiptTextIcon from "@lucide/svelte/icons/receipt-text";
import ReplyAllIcon from "@lucide/svelte/icons/reply-all";
import SettingsIcon from "@lucide/svelte/icons/settings";
import StarIcon from "@lucide/svelte/icons/star";
import TrashIcon from "@lucide/svelte/icons/trash-2";
import type { Component } from "svelte";

import type { MailboxType } from "./graphql/generated/graphql";

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
