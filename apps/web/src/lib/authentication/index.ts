const ACCESS_TOKEN_LOCAL_STORAGE_KEY = "gebna_access_token";

export function setAccessToken(value: string) {
	localStorage.setItem(ACCESS_TOKEN_LOCAL_STORAGE_KEY, value);
}

export function getAccessToken() {
	return localStorage.getItem(ACCESS_TOKEN_LOCAL_STORAGE_KEY);
}

export function deleteAccessToken() {
	localStorage.removeItem(ACCESS_TOKEN_LOCAL_STORAGE_KEY);
}
