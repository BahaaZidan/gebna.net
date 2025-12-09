export type SessionCreatedSuccessResponse = {
	accessToken: string;
	accessTokenExpiresAt: number;
	sessionId: string;
	user: {
		id: string;
		username: string;
	};
};

export type SessionCreatedErrorResponse = {
	error: AUTH_ERROR;
};

export type AUTH_ERROR = "BAD_REQUEST" | "UNAUTHORIZED" | "USERNAME_TAKEN";

export const isSessionCreatedErrorResponse = (data: unknown): data is SessionCreatedErrorResponse =>
	typeof data === "object" && data !== null && "error" in data;

export const isSessionCreatedSuccessResponse = (
	data: unknown
): data is SessionCreatedSuccessResponse =>
	typeof data === "object" && data !== null && "accessToken" in data;
