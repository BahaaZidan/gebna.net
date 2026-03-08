<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { graphql, useFragment, type FragmentType } from "@gebna/graphql-client";
	import {
		CalendarDotIcon,
		FileArchiveIcon,
		FileIcon,
		FilePdfIcon,
		GridNineIcon,
		IconContext,
		ImageIcon,
		MicrosoftWordLogoIcon,
		PresentationChartIcon,
		VideoIcon,
		WaveformIcon,
	} from "phosphor-svelte";

	import { formatInboxDate } from "../../utils/format";

	const EmailMessageBubble = graphql(`
		fragment EmailMessageBubble on EmailMessage {
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
	`);

	let props: { message: FragmentType<typeof EmailMessageBubble> } = $props();
	let message = $derived(useFragment(EmailMessageBubble, props.message));
	let sender = $derived(message.from);
	let emailBodyHost: HTMLDivElement | null = $state(null);

	$effect(() => {
		if (!emailBodyHost) return;

		const shadowRoot = emailBodyHost.shadowRoot ?? emailBodyHost.attachShadow({ mode: "open" });
		shadowRoot.innerHTML = message.html ?? "";
	});
</script>

<div class="flex w-full items-start gap-4 p-3">
	<div class="avatar">
		<div class="w-12">
			<img alt="{sender.name || sender.address} avatar" src={sender.avatar} />
		</div>
	</div>
	<div class="flex w-full flex-col gap-2">
		<div class="flex items-baseline gap-1">
			<div class="font-bold">{sender.name || sender.address}</div>
			<time class="text-xs">{formatInboxDate(message.createdAt)}</time>
		</div>
		{#if message.plaintext}
			<div>
				<pre class="">{message.plaintext}</pre>
			</div>
		{:else if message.html}
			<div class="w-full">
				<div bind:this={emailBodyHost} class="w-full"></div>
			</div>
		{/if}
		{#if message.attachments.length}
			<div class="flex gap-2">
				{#each message.attachments as a (a.id)}
					<a
						href={a.url}
						download={a.filename}
						class="flex gap-2 bg-base-200 px-4 py-2 hover:cursor-pointer hover:bg-base-300"
					>
						<div>
							<IconContext values={{ class: "size-12" }}>
								{#if a.category === "Archive"}
									<FileArchiveIcon />
								{:else if a.category === "Audio"}
									<WaveformIcon />
								{:else if a.category === "Video"}
									<VideoIcon />
								{:else if a.category === "PDF"}
									<FilePdfIcon />
								{:else if a.category === "Word"}
									<MicrosoftWordLogoIcon />
								{:else if a.category === "Slides"}
									<PresentationChartIcon />
								{:else if a.category === "Excel"}
									<GridNineIcon />
								{:else if a.category === "Image"}
									<ImageIcon />
								{:else if a.category === "Calendar"}
									<CalendarDotIcon />
								{:else}
									<FileIcon />
								{/if}
							</IconContext>
						</div>
						<div class="flex flex-col justify-center gap-1">
							<div>{a.filename}</div>
							<div class="text-sm text-secondary-content">{a.description}</div>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>
