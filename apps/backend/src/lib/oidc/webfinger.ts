import { ISSUER } from "./constants";

export const OPENID_ISSUER_REL = "http://openid.net/specs/connect/1.0/issuer";

export function buildWebFingerResponse(resource: string) {
	return {
		subject: resource,
		links: [
			{
				rel: OPENID_ISSUER_REL,
				href: ISSUER,
			},
		],
	};
}
