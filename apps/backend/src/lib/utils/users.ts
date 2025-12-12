const PLACEHOLDER_COLORS = [
	'#1abc9c',
	'#3498db',
	'#9b59b6',
	'#e67e22',
	'#e74c3c',
	'#16a085',
	'#2980b9',
	'#8e44ad',
	'#2c3e50',
];

export function generateImagePlaceholder(name: string) {
	const trimmed = name.trim();
	const initials =
		trimmed
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('') || '?';
	const color =
		PLACEHOLDER_COLORS[
			Math.floor(Math.random() * PLACEHOLDER_COLORS.length)
		];
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="${color}"/><text x="50%" y="50%" dy="0.35em" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif" font-size="48" font-weight="700">${initials}</text></svg>`;

	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
