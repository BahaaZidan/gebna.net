// floating-dropdown.ts
import { autoUpdate, computePosition, flip, offset, shift, type Placement } from "@floating-ui/dom";

export type FloatingDropdownOptions = {
	placement?: Placement; // e.g. "left-start", "bottom-end"
	offsetPx?: number; // gap between trigger and menu
	shiftPadding?: number; // viewport padding for shift()
	zIndex?: number; // menu z-index
};

export function floatingDropdown(node: HTMLDetailsElement, opts: FloatingDropdownOptions = {}) {
	const summary = node.querySelector("summary") as HTMLElement | null;
	const menu = node.querySelector(".dropdown-content") as HTMLElement | null;

	if (!summary || !menu) {
		return { destroy() {} };
	}

	let options: Required<FloatingDropdownOptions> = {
		placement: opts.placement ?? "bottom-end",
		offsetPx: opts.offsetPx ?? 8,
		shiftPadding: opts.shiftPadding ?? 8,
		zIndex: opts.zIndex ?? 1000,
	};

	// Make menu escape scroll containers (your chat list is overflow-y-auto)
	menu.style.position = "fixed";
	menu.style.margin = "0";
	menu.style.zIndex = String(options.zIndex);

	let stopAutoUpdate: (() => void) | null = null;

	const updatePosition = async () => {
		const { x, y } = await computePosition(summary, menu, {
			placement: options.placement,
			middleware: [offset(options.offsetPx), flip(), shift({ padding: options.shiftPadding })],
		});

		menu.style.left = `${x}px`;
		menu.style.top = `${y}px`;
	};

	const start = () => {
		stopAutoUpdate?.();
		stopAutoUpdate = autoUpdate(summary, menu, updatePosition);
		void updatePosition();
	};

	const stop = () => {
		stopAutoUpdate?.();
		stopAutoUpdate = null;
	};

	const onToggle = () => {
		if (node.open) start();
		else stop();
	};

	// Click away closes
	const onDocPointerDown = (e: PointerEvent) => {
		const target = e.target as Node | null;
		if (!target) return;
		if (node.open && !node.contains(target)) node.open = false;
	};

	// Escape closes
	const onDocKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Escape" && node.open) node.open = false;
	};

	// Clicking a menu option closes
	const onMenuClick = (e: MouseEvent) => {
		const target = e.target as HTMLElement | null;
		if (!target) return;

		// close only if the click came from a clickable item
		const clickable = target.closest("a,button,[role='menuitem']") as HTMLElement | null;

		if (!clickable) return;

		node.open = false;
	};

	node.addEventListener("toggle", onToggle);
	document.addEventListener("pointerdown", onDocPointerDown, true);
	document.addEventListener("keydown", onDocKeyDown);
	menu.addEventListener("click", onMenuClick);

	return {
		update(next: FloatingDropdownOptions) {
			options = {
				placement: next.placement ?? options.placement,
				offsetPx: next.offsetPx ?? options.offsetPx,
				shiftPadding: next.shiftPadding ?? options.shiftPadding,
				zIndex: next.zIndex ?? options.zIndex,
			};

			menu.style.zIndex = String(options.zIndex);

			if (node.open) void updatePosition();
		},
		destroy() {
			stop();
			node.removeEventListener("toggle", onToggle);
			document.removeEventListener("pointerdown", onDocPointerDown, true);
			document.removeEventListener("keydown", onDocKeyDown);
			menu.removeEventListener("click", onMenuClick);
		},
	};
}
