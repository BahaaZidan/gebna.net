class SessionTokenBase {
	private key = "gebna_access_token";

	public set value(v: string) {
		localStorage.setItem(this.key, v);
	}

	public get value(): string {
		return localStorage.getItem(this.key) || "";
	}

	public delete(): void {
		localStorage.removeItem(this.key);
	}
}

export const SessionToken = new SessionTokenBase();

export const makeFetch: (options?: { signal?: AbortSignal }) => typeof fetch =
	(options) =>
	(input, init = {}) => {
		const headers = new Headers(init.headers || {});
		headers.set("Authorization", `Bearer ${SessionToken.value}`);

		const modifiedInit: RequestInit = {
			...init,
			headers,
			signal: options?.signal,
		};

		return fetch(input, modifiedInit);
	};
