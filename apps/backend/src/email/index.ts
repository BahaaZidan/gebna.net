export function getR2KeyFromHash(hash: string) {
	return `v1/raw/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}.eml`;
}
