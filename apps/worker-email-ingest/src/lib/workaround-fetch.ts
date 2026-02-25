/** Until drizzle supports the turso serverless driver, we need this abomination */
export const workAroundFetch: typeof fetch = async (input, init) => {
	if (typeof input === "string" || input instanceof URL) {
		return fetch(input, init);
	}
	if (input && typeof input === "object" && "url" in input) {
		const requestLike = input as {
			url: string;
			method?: string;
			headers?: Headers;
			body?: unknown;
			// @ts-ignore
			redirect?: RequestRedirect;
			signal?: AbortSignal | null;
			arrayBuffer?: () => Promise<ArrayBuffer>;
		};
		const headers = new Headers();
		requestLike.headers?.forEach((value, key) => headers.append(key, value));
		const body =
			requestLike.arrayBuffer && requestLike.body != null
				? await requestLike.arrayBuffer()
				: (requestLike.body as BodyInit | null | undefined);
		return fetch(requestLike.url, {
			method: requestLike.method,
			headers,
			body,
			redirect: requestLike.redirect,
			signal: requestLike.signal ?? undefined,
		});
	}
	return fetch(input as RequestInfo, init);
};
