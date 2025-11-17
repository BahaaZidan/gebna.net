const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let out = "";
	for (let i = 0; i < bytes.length; i++) {
		out += bytes[i].toString(16).padStart(2, "0");
	}
	return out;
}

async function hmacSha256(key: ArrayBufferLike, data: string): Promise<ArrayBuffer> {
	const keyView = new Uint8Array(key);

	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		keyView,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"]
	);

	return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
}

export async function signAwsRequest(options: {
	method: string;
	url: URL;
	service: string;
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	body: string;
	extraHeaders?: Record<string, string>;
}): Promise<Record<string, string>> {
	const { method, url, service, region, accessKeyId, secretAccessKey, body, extraHeaders } =
		options;

	const now = new Date();
	// 20250101T120000Z
	const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
	const dateStamp = amzDate.slice(0, 8); // 20250101

	const host = url.host;
	const canonicalUri = url.pathname || "/";
	const canonicalQuerystring = ""; // no query params for SES SendEmail

	const baseHeaders: Record<string, string> = {
		host,
		"x-amz-date": amzDate,
		"content-type": "application/json",
	};

	const headers: Record<string, string> = {
		...baseHeaders,
		...(extraHeaders ?? {}),
	};

	const signedHeaderNames = Object.keys(headers)
		.map((h) => h.toLowerCase())
		.sort();

	const canonicalHeaders = signedHeaderNames.map((h) => `${h}:${headers[h].trim()}\n`).join("");

	const payloadHash = await crypto.subtle.digest("SHA-256", encoder.encode(body));
	const payloadHashHex = toHex(payloadHash);

	const canonicalRequest = [
		method.toUpperCase(),
		canonicalUri,
		canonicalQuerystring,
		canonicalHeaders,
		signedHeaderNames.join(";"),
		payloadHashHex,
	].join("\n");

	const algorithm = "AWS4-HMAC-SHA256";
	const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
	const canonicalRequestHash = await crypto.subtle.digest(
		"SHA-256",
		encoder.encode(canonicalRequest)
	);

	const stringToSign = [algorithm, amzDate, credentialScope, toHex(canonicalRequestHash)].join(
		"\n"
	);

	const kSecret = encoder.encode(`AWS4${secretAccessKey}`).buffer;
	const kDate = await hmacSha256(kSecret, dateStamp);
	const kRegion = await hmacSha256(kDate, region);
	const kService = await hmacSha256(kRegion, service);
	const kSigning = await hmacSha256(kService, "aws4_request");

	const signatureBytes = await hmacSha256(kSigning, stringToSign);
	const signature = toHex(signatureBytes);

	const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderNames.join(
		";"
	)}, Signature=${signature}`;

	return {
		...headers,
		Authorization: authorizationHeader,
		"x-amz-content-sha256": payloadHashHex,
	};
}
