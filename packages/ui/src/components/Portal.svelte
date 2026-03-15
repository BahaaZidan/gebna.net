<script lang="ts" module>
	import { tick } from "svelte";
	import type { Action } from "svelte/action";

	type PortalTarget = HTMLElement | string;

	async function resolveTarget(target: PortalTarget): Promise<HTMLElement> {
		if (typeof target === "string") {
			let targetEl = document.querySelector<HTMLElement>(target);

			if (!targetEl) {
				await tick();
				targetEl = document.querySelector<HTMLElement>(target);
			}

			if (!targetEl) {
				throw new Error(`No element found matching css selector: "${target}"`);
			}

			return targetEl;
		}

		if (target instanceof HTMLElement) {
			return target;
		}

		throw new TypeError(
			`Unknown portal target type: ${target === null ? "null" : typeof target}. Allowed types: string (CSS selector) or HTMLElement.`
		);
	}

	export const portal: Action<HTMLElement, PortalTarget | undefined> = (el, target = "body") => {
		let targetEl: HTMLElement | null = null;

		const moveToTarget = async (nextTarget: PortalTarget | undefined) => {
			targetEl = await resolveTarget(nextTarget ?? "body");
			targetEl.appendChild(el);
			el.hidden = false;
		};

		const destroy = () => {
			el.remove();
			targetEl = null;
		};

		void moveToTarget(target);

		return {
			update: (nextTarget) => void moveToTarget(nextTarget),
			destroy,
		};
	};
</script>

<script lang="ts">
	import type { Snippet } from "svelte";

	type PortalTarget = HTMLElement | string;

	let { target = "body", children }: { target?: PortalTarget; children?: Snippet } = $props();
</script>

<div use:portal={target} hidden>
	{@render children?.()}
</div>
