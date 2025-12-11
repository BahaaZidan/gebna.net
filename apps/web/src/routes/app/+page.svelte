<script lang="ts">
	import Calendar1Icon from "@lucide/svelte/icons/calendar-1";
	import FileTextIcon from "@lucide/svelte/icons/file-text";
	import FolderIcon from "@lucide/svelte/icons/folder";
	import MailIcon from "@lucide/svelte/icons/mail";
	import PresentationIcon from "@lucide/svelte/icons/presentation";
	import SheetIcon from "@lucide/svelte/icons/sheet";

	import { resolve } from "$app/paths";
</script>

<div class="flex flex-wrap gap-2 p-4">
	<a
		href={resolve("/app/mail")}
		class="flex flex-col items-center rounded-2xl p-10 hover:bg-accent"
	>
		<MailIcon /> Email
	</a>

	<a
		href={resolve("/app/mail")}
		class="flex flex-col items-center rounded-2xl p-10 hover:bg-accent"
	>
		<Calendar1Icon /> Calendar
	</a>

	<a
		href={resolve("/app/mail")}
		class="flex flex-col items-center rounded-2xl p-10 hover:bg-accent"
	>
		<Calendar1Icon /> Calendar
	</a>

	<a
		href={resolve("/app/mail")}
		class="flex flex-col items-center rounded-2xl p-10 hover:bg-accent"
	>
		<FolderIcon /> Storage
	</a>

	<a
		href={resolve("/app/mail")}
		class="flex flex-col items-center rounded-2xl p-10 hover:bg-accent"
	>
		<FileTextIcon /> Documents
	</a>

	<a
		href={resolve("/app/mail")}
		class="flex flex-col items-center rounded-2xl p-10 hover:bg-accent"
	>
		<SheetIcon /> Sheets
	</a>

	<a
		href={resolve("/app/mail")}
		class="flex flex-col items-center rounded-2xl p-10 hover:bg-accent"
	>
		<PresentationIcon /> Presentations
	</a>
</div>
