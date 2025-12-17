import { parseAttr, parseTag } from "xss";
import type { Email } from "postal-mime";

export type NormalizeEmailOptions = {
	maxHtmlBytes?: number;
	maxTextBytes?: number;
	blockRemoteImagesByDefault?: boolean;
	allowDataImages?: boolean;
	keepHeadStyleTags?: boolean;
	stripInlineStyleAttributes?: boolean;
	cidResolver?: (cid: string) => string | null;
	remoteImagePlaceholder?: string;
};

export type NormalizedEmailBody = {
	kind: "html" | "text" | "empty";
	htmlDocument: string;
	text: string;
	warnings: string[];
	flags: {
		hadHtml: boolean;
		hadText: boolean;
		htmlTruncated: boolean;
		textTruncated: boolean;
		wasMalformedHtml: boolean;
		strippedScripts: boolean;
		strippedEventHandlers: boolean;
		strippedDangerousUrls: boolean;
		blockedRemoteImages: boolean;
		hasRemoteImages: boolean;
		rewroteCidUrls: boolean;
		droppedUnsupportedTags: boolean;
	};
};

type NormalizedOptions = Required<Omit<NormalizeEmailOptions, "cidResolver" | "remoteImagePlaceholder">> &
	Pick<NormalizeEmailOptions, "cidResolver" | "remoteImagePlaceholder">;

const DEFAULT_OPTIONS: NormalizedOptions = {
	maxHtmlBytes: 1_000_000,
	maxTextBytes: 300_000,
	blockRemoteImagesByDefault: true,
	allowDataImages: false,
	keepHeadStyleTags: true,
	stripInlineStyleAttributes: false,
	cidResolver: undefined,
	remoteImagePlaceholder: undefined,
};

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

const VOID_TAGS = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
]);

const DROP_WITH_CONTENT_TAGS = new Set([
	"script",
	"iframe",
	"frame",
	"frameset",
	"object",
	"embed",
	"applet",
	"form",
	"input",
	"button",
	"textarea",
	"select",
	"option",
	"video",
	"audio",
	"source",
	"track",
	"portal",
]);

const DROP_TAGS = new Set(["base", "link", "meta"]);

const URL_ATTRS = new Set([
	"href",
	"src",
	"xlink:href",
	"poster",
	"data",
	"cite",
	"background",
	"formaction",
]);

type SanitizationFlags = NormalizedEmailBody["flags"];

export function normalizeAndSanitizeEmailBody(
	parsedEmail: Email,
	options: NormalizeEmailOptions = {}
): NormalizedEmailBody {
	const resolvedOptions: NormalizedOptions = { ...DEFAULT_OPTIONS, ...options };

	const rawHtml = parsedEmail.html ?? "";
	const rawText = parsedEmail.text ?? "";
	const hadHtml = rawHtml.trim().length > 0;
	const hadText = rawText.trim().length > 0;

	const warnings: string[] = [];
	const flags: SanitizationFlags = {
		hadHtml,
		hadText,
		htmlTruncated: false,
		textTruncated: false,
		wasMalformedHtml: false,
		strippedScripts: false,
		strippedEventHandlers: false,
		strippedDangerousUrls: false,
		blockedRemoteImages: false,
		hasRemoteImages: false,
		rewroteCidUrls: false,
		droppedUnsupportedTags: false,
	};

	if (hadHtml) {
		const truncated = truncateToBytes(rawHtml, resolvedOptions.maxHtmlBytes);
		flags.htmlTruncated = truncated.truncated;
		if (flags.htmlTruncated) warnings.push("html_truncated");

		const { bodyHtml, headStyles, flags: sanitizeFlags } = sanitizeHtmlBody(
			truncated.value,
			resolvedOptions
		);
		Object.assign(flags, sanitizeFlags);
		if (flags.wasMalformedHtml) warnings.push("malformed_html");

		const textResult = truncateToBytes(rawText, resolvedOptions.maxTextBytes);
		flags.textTruncated = textResult.truncated;
		if (flags.textTruncated) warnings.push("text_truncated");

		return {
			kind: "html",
			htmlDocument: buildHtmlDocument(bodyHtml, headStyles),
			text: textResult.value,
			warnings,
			flags,
		};
	}

	if (hadText) {
		const truncated = truncateToBytes(rawText, resolvedOptions.maxTextBytes);
		flags.textTruncated = truncated.truncated;
		if (flags.textTruncated) warnings.push("text_truncated");

		const bodyHtml = textToHtml(truncated.value);
		return {
			kind: "text",
			htmlDocument: buildHtmlDocument(bodyHtml, []),
			text: truncated.value,
			warnings,
			flags,
		};
	}

	warnings.push("empty_body");

	return {
		kind: "empty",
		htmlDocument: buildHtmlDocument("<div>No content</div>", []),
		text: "",
		warnings,
		flags,
	};
}

function sanitizeHtmlBody(html: string, options: NormalizedOptions) {
	const headStyles: string[] = [];
	const flags: Pick<
		SanitizationFlags,
		| "wasMalformedHtml"
		| "strippedScripts"
		| "strippedEventHandlers"
		| "strippedDangerousUrls"
		| "blockedRemoteImages"
		| "hasRemoteImages"
		| "rewroteCidUrls"
		| "droppedUnsupportedTags"
	> = {
		wasMalformedHtml: false,
		strippedScripts: false,
		strippedEventHandlers: false,
		strippedDangerousUrls: false,
		blockedRemoteImages: false,
		hasRemoteImages: false,
		rewroteCidUrls: false,
		droppedUnsupportedTags: false,
	};

	let inHead = false;
	let inBody = false;
	let sawBody = false;
	const ignoreStack: string[] = [];
	let styleCaptureDepth = 0;

	const output = parseTag(
		html,
		(_sourcePos, _pos, tagName, tagHtml, isClosing) => {
			const normalizedTag = tagName.toLowerCase();
			const isVoid = VOID_TAGS.has(normalizedTag);
			const isSelfClosing = isVoid || tagHtml.endsWith("/>");

			if (!tagHtml.endsWith(">")) flags.wasMalformedHtml = true;

			if (ignoreStack.length > 0) {
				if (isClosing) popIgnore(ignoreStack, normalizedTag);
				if (!isClosing && DROP_WITH_CONTENT_TAGS.has(normalizedTag)) {
					ignoreStack.push(normalizedTag);
				}
				return "";
			}

			if (normalizedTag === "head") {
				inHead = !isClosing;
				return "";
			}

			if (normalizedTag === "body") {
				sawBody = true;
				inBody = !isClosing;
				return "";
			}

			if (normalizedTag === "html" || normalizedTag === "!doctype") {
				return "";
			}

			if (normalizedTag === "style") {
				if (isClosing) {
					if (styleCaptureDepth > 0) styleCaptureDepth -= 1;
					return "";
				}
				if (inHead && options.keepHeadStyleTags) {
					styleCaptureDepth += 1;
					return "";
				}
				flags.droppedUnsupportedTags = true;
				if (!isSelfClosing) ignoreStack.push(normalizedTag);
				return "";
			}

			if (DROP_WITH_CONTENT_TAGS.has(normalizedTag)) {
				flags.droppedUnsupportedTags = true;
				if (normalizedTag === "script") flags.strippedScripts = true;
				if (!isClosing && !isSelfClosing) ignoreStack.push(normalizedTag);
				return "";
			}

			if (DROP_TAGS.has(normalizedTag)) {
				flags.droppedUnsupportedTags = true;
				return "";
			}

			const outputEnabled = inBody || (!sawBody && !inHead);
			if (isClosing) {
				if (!outputEnabled || isVoid) return "";
				return `</${normalizedTag}>`;
			}

			if (!outputEnabled) {
				flags.droppedUnsupportedTags = true;
				return "";
			}

			const attrHtml = extractAttrHtml(tagHtml, normalizedTag);
			const { attrString, dropTag, placeholderHtml } = sanitizeAttributesForTag(
				normalizedTag,
				attrHtml,
				options,
				flags
			);
			if (dropTag) {
				flags.droppedUnsupportedTags = true;
				return placeholderHtml ?? "";
			}

			return `<${normalizedTag}${attrString ? ` ${attrString}` : ""}>`;
		},
		(text) => {
			if (ignoreStack.length > 0) return "";
			if (styleCaptureDepth > 0) {
				headStyles.push(text);
				return "";
			}
			const outputEnabled = inBody || (!sawBody && !inHead);
			return outputEnabled ? text : "";
		}
	);

	return { bodyHtml: output, headStyles, flags };
}

function extractAttrHtml(tagHtml: string, tagName: string) {
	let raw = tagHtml.slice(1, -1);
	if (raw.endsWith("/")) raw = raw.slice(0, -1);
	const tagIndex = raw.toLowerCase().indexOf(tagName);
	if (tagIndex === -1) return "";
	const start = tagIndex + tagName.length;
	const attrStart = raw.slice(start).search(/\s/);
	if (attrStart === -1) return "";
	return raw.slice(start + attrStart + 1);
}

function sanitizeAttributesForTag(
	tagName: string,
	attrHtml: string,
	options: NormalizedOptions,
	flags: Pick<
		SanitizationFlags,
		| "strippedEventHandlers"
		| "strippedDangerousUrls"
		| "blockedRemoteImages"
		| "hasRemoteImages"
		| "rewroteCidUrls"
		| "droppedUnsupportedTags"
	>
) {
	const attrs: Array<{ name: string; value: string }> = [];
	parseAttr(attrHtml, (name, value) => {
		attrs.push({ name, value });
		return "";
	});

	const sanitized: Array<{ name: string; value: string | null }> = [];
	const attrIndex = new Map<string, number>();
	let dropTag = false;
	let placeholderHtml: string | undefined;

	const setAttr = (name: string, value: string | null) => {
		if (attrIndex.has(name)) {
			sanitized[attrIndex.get(name)!] = { name, value };
			return;
		}
		attrIndex.set(name, sanitized.length);
		sanitized.push({ name, value });
	};

	for (const { name, value } of attrs) {
		const normalizedName = name.toLowerCase();
		if (normalizedName.startsWith("on")) {
			flags.strippedEventHandlers = true;
			continue;
		}
		if (normalizedName === "style" && options.stripInlineStyleAttributes) {
			continue;
		}

		if (tagName === "img" && normalizedName === "src") {
			const resolved = resolveImageSrc(value, options, flags);
			if (resolved.action === "drop-tag") {
				dropTag = true;
				placeholderHtml = resolved.placeholderHtml;
			} else if (resolved.action === "set" && resolved.value) {
				setAttr(normalizedName, resolved.value);
			}
			continue;
		}

		if (normalizedName === "srcset") {
			const sanitizedSrcset = sanitizeSrcset(value, options, flags, tagName === "img");
			if (sanitizedSrcset) setAttr(normalizedName, sanitizedSrcset);
			continue;
		}

		if (URL_ATTRS.has(normalizedName)) {
			const sanitizedUrl = sanitizeUrlValue(value, options, flags, tagName === "img");
			if (sanitizedUrl) setAttr(normalizedName, sanitizedUrl);
			continue;
		}

		setAttr(normalizedName, value);
	}

	if (tagName === "img" && !dropTag) {
		if (!attrIndex.has("src")) dropTag = true;
	}

	if (tagName === "a" && attrIndex.has("href")) {
		setAttr("rel", "noreferrer noopener");
		setAttr("target", "_blank");
	}

	return {
		attrString: sanitized
			.filter((attr) => attr.value !== null)
			.map((attr) =>
				attr.value === "" ? attr.name : `${attr.name}="${escapeAttribute(attr.value!)}"`
			)
			.join(" "),
		dropTag,
		placeholderHtml,
	};
}

function resolveImageSrc(
	value: string,
	options: NormalizedOptions,
	flags: Pick<
		SanitizationFlags,
		"strippedDangerousUrls" | "blockedRemoteImages" | "hasRemoteImages" | "rewroteCidUrls"
	>
) {
	const trimmed = value.trim();
	if (!trimmed) return { action: "drop-tag" as const };

	const compact = trimmed.replace(/\s+/g, "");
	const lower = compact.toLowerCase();

	if (lower.startsWith("cid:")) {
		const cid = compact.slice(4);
		const resolved = options.cidResolver ? options.cidResolver(cid) : null;
		if (!resolved) return { action: "drop-tag" as const };
		const sanitized = sanitizeUrlValue(resolved, options, flags, true);
		if (!sanitized) return { action: "drop-tag" as const };
		flags.rewroteCidUrls = true;
		return { action: "set" as const, value: sanitized };
	}

	if (lower.startsWith("data:")) {
		if (options.allowDataImages && lower.startsWith("data:image/")) {
			return { action: "set" as const, value: trimmed };
		}
		flags.strippedDangerousUrls = true;
		return { action: "drop-tag" as const };
	}

	if (isDangerousScheme(lower)) {
		flags.strippedDangerousUrls = true;
		return { action: "drop-tag" as const };
	}

	const isRemote =
		lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("//");
	if (isRemote) {
		flags.hasRemoteImages = true;
		if (options.blockRemoteImagesByDefault) {
			flags.blockedRemoteImages = true;
			return {
				action: "drop-tag" as const,
				placeholderHtml: options.remoteImagePlaceholder,
			};
		}
	}

	return { action: "set" as const, value: trimmed };
}

function sanitizeUrlValue(
	value: string,
	options: NormalizedOptions,
	flags: Pick<SanitizationFlags, "strippedDangerousUrls">,
	allowDataImages: boolean
) {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const compact = trimmed.replace(/\s+/g, "");
	const lower = compact.toLowerCase();

	if (isDangerousScheme(lower)) {
		flags.strippedDangerousUrls = true;
		return null;
	}

	if (lower.startsWith("data:")) {
		if (allowDataImages && options.allowDataImages && lower.startsWith("data:image/")) {
			return trimmed;
		}
		flags.strippedDangerousUrls = true;
		return null;
	}

	if (lower.startsWith("cid:")) {
		flags.strippedDangerousUrls = true;
		return null;
	}

	return trimmed;
}

function sanitizeSrcset(
	value: string,
	options: NormalizedOptions,
	flags: Pick<SanitizationFlags, "strippedDangerousUrls">,
	allowDataImages: boolean
) {
	const entries = value
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
	const sanitized: string[] = [];
	for (const entry of entries) {
		const [url, ...rest] = entry.split(/\s+/);
		const sanitizedUrl = sanitizeUrlValue(url, options, flags, allowDataImages);
		if (!sanitizedUrl) continue;
		sanitized.push([sanitizedUrl, ...rest].filter(Boolean).join(" "));
	}
	return sanitized.length ? sanitized.join(", ") : null;
}

function isDangerousScheme(value: string) {
	return (
		value.startsWith("javascript:") || value.startsWith("vbscript:") || value.startsWith("file:")
	);
}

function escapeAttribute(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("\"", "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

function popIgnore(stack: string[], tagName: string) {
	const index = stack.lastIndexOf(tagName);
	if (index !== -1) stack.splice(index, 1);
}

function textToHtml(text: string) {
	const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	const lines = normalized.split("\n").map(escapeText);
	return lines.join("<br>");
}

function escapeText(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll("\"", "&quot;")
		.replaceAll("'", "&#39;");
}

function truncateToBytes(value: string, maxBytes: number) {
	const bytes = utf8Encoder.encode(value);
	if (bytes.length <= maxBytes) return { value, truncated: false };
	return { value: utf8Decoder.decode(bytes.subarray(0, maxBytes)), truncated: true };
}

function buildHtmlDocument(bodyHtml: string, headStyles: string[]) {
	const baseStyle = [
		"html, body { margin: 0; padding: 0; }",
		"body { overflow-wrap: anywhere; word-break: break-word; }",
		"img { max-width: 100%; height: auto; }",
		"table { max-width: 100%; }",
	].join("\n");
	const headStyleBlocks = headStyles
		.map((style) => `<style>${style}</style>`)
		.join("");

	return [
		"<!doctype html>",
		"<html>",
		"<head>",
		'<meta charset="utf-8">',
		'<meta name="viewport" content="width=device-width, initial-scale=1">',
		headStyleBlocks,
		`<style>${baseStyle}</style>`,
		"</head>",
		`<body>${bodyHtml}</body>`,
		"</html>",
	].join("");
}
