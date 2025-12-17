export function autoIframeHeight(node: HTMLIFrameElement) {
	let observer: ResizeObserver | null = null;
	let timeouts: number[] = [];

	const measure = () => {
		try {
			const doc = node.contentDocument;
			if (!doc) return;
			const height = Math.max(
				doc.documentElement.scrollHeight,
				doc.body?.scrollHeight || 0
			);
			if (height) node.style.height = `${height}px`;
		} catch {
			// Ignore cross-origin access errors.
		}
	};

	const onLoad = () => {
		measure();
		timeouts = [100, 300, 800].map((delay) =>
			window.setTimeout(() => measure(), delay)
		);
		const doc = node.contentDocument;
		if (doc && typeof ResizeObserver !== "undefined") {
			observer = new ResizeObserver(() => measure());
			observer.observe(doc.documentElement);
		}
	};

	node.addEventListener("load", onLoad);
	requestAnimationFrame(() => measure());

	return {
		update: () => requestAnimationFrame(() => measure()),
		destroy: () => {
			node.removeEventListener("load", onLoad);
			if (observer) observer.disconnect();
			timeouts.forEach((timeout) => window.clearTimeout(timeout));
			timeouts = [];
		},
	};
}
