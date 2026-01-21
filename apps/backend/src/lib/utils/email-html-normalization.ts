import { htmlToText } from "html-to-text";
import type { Email } from "postal-mime";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import TurndownService from "turndown";
import { unified } from "unified";
import * as xss from "xss";

const xssExports =
	// @ts-expect-error That’s the ESM/CJS interop quirk — parseTag lives on the CJS default export. I wired a module-level xssExports shim so runtime gets parseTag/parseAttr correctly.
	("default" in xss ? (xss as { default: typeof xss }).default : xss) as typeof xss;

type NormalizeEmailOptions = {
	maxHtmlBytes?: number;
	maxTextBytes?: number;
	blockRemoteImagesByDefault?: boolean;
	allowDataImages?: boolean;
	keepHeadStyleTags?: boolean;
	stripInlineStyleAttributes?: boolean;
	cidResolver?: (cid: string) => string | null;
	remoteImagePlaceholder?: string;
};

type NormalizedOptions = Required<
	Omit<NormalizeEmailOptions, "cidResolver" | "remoteImagePlaceholder">
> &
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

type SanitizationFlags = {
	wasMalformedHtml: boolean;
	strippedScripts: boolean;
	strippedEventHandlers: boolean;
	strippedDangerousUrls: boolean;
	blockedRemoteImages: boolean;
	hasRemoteImages: boolean;
	rewroteCidUrls: boolean;
	droppedUnsupportedTags: boolean;
};

export async function normalizeAndSanitizeEmailBody(
	parsedEmail: Email,
	options: NormalizeEmailOptions = {}
): Promise<{
	html: string;
	plain: string;
	md: string;
} | null> {
	const resolvedOptions: NormalizedOptions = { ...DEFAULT_OPTIONS, ...options };

	const rawHtml = parsedEmail.html?.trim();
	const rawText = parsedEmail.text?.trim();

	if (!rawHtml?.length && !rawText?.length) return null;
	const source = rawHtml || rawText;
	if (!source) return null;

	const truncated = truncateToBytes(source, resolvedOptions.maxHtmlBytes);
	const { bodyHtml, headStyles } = sanitizeHtmlBody(truncated.value, resolvedOptions);

	const markdownHtml = await htmlToMarkdownHTML(bodyHtml);

	const textSource = htmlToText(markdownHtml, {
		wordwrap: false,
		selectors: [
			{ selector: "img", format: "skip" },
			{ selector: "style", format: "skip" },
			{ selector: "script", format: "skip" },
		],
	}).replace(/\n{2,}/g, "\n");
	const textResult = truncateToBytes(textSource, resolvedOptions.maxTextBytes);

	return {
		html: buildHtmlDocument(bodyHtml, headStyles),
		plain: textResult.value,
		md: markdownHtml,
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
	const resetStyleCapture = () => {
		if (styleCaptureDepth > 0) styleCaptureDepth = 0;
	};

	const output = xssExports.parseTag(
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
				if (isClosing) resetStyleCapture();
				return "";
			}

			if (normalizedTag === "body") {
				sawBody = true;
				inBody = !isClosing;
				if (!isClosing) resetStyleCapture();
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
				if (!inHead) resetStyleCapture();
				else {
					headStyles.push(text);
					return "";
				}
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
	xssExports.parseAttr(attrHtml, (name, value) => {
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
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

function popIgnore(stack: string[], tagName: string) {
	const index = stack.lastIndexOf(tagName);
	if (index !== -1) stack.splice(index, 1);
}

async function htmlToMarkdownHTML(html: string): Promise<string> {
	const turndown = makeTurndownMeaninglessCleaner();

	const md = turndown.turndown(html);

	const resultHTML = (
		await unified()
			.use(remarkParse)
			.use(remarkGfm)
			.use(remarkRehype)
			.use(rehypeStringify)
			.process(md)
	).toString();

	return resultHTML.replace(EMPTY_PARAGRAPH_RE, "");
}

// eslint-disable-next-line no-misleading-character-class
const INVISIBLE_RE = /[\p{White_Space}\p{Zs}\u00A0\u00AD\u200B\u200C\u200D\uFEFF\u034F]+/gu;
// eslint-disable-next-line no-misleading-character-class
const TEXT_INVISIBLE_RE = /[\u00AD\u200B\u200C\u200D\uFEFF\u034F]+/g;
const EMPTY_PARAGRAPH_RE = /<p>(?:\s|&nbsp;|&#160;|&#xA0;|\u00A0)*<\/p>/g;

function stripInvisible(s: string): string {
	return s.replace(INVISIBLE_RE, "");
}

function isMeaninglessText(s: string): boolean {
	return stripInvisible(s).length === 0;
}

function makeTurndownMeaninglessCleaner() {
	const turndown = new TurndownService();

	// 1) Remove images (since you wanted that)
	turndown.addRule("dropImages", {
		filter: (node) => node.nodeName === "IMG",
		replacement: () => "",
	});

	// 2) CLEAN ALL TEXT NODES (this is the key)
	// Turndown processes text nodes via "escape", so override it.
	const originalEscape = turndown.escape.bind(turndown);
	turndown.escape = (text: string) => {
		// Remove zero-width-ish chars but keep normal spacing intact
		const cleaned = text.replace(TEXT_INVISIBLE_RE, "").replace(/\u00A0/g, " ");
		// Then let Turndown do its normal escaping
		return originalEscape(cleaned);
	};
	const escape = turndown.escape.bind(turndown);

	turndown.addRule("unwrapNestedAnchors", {
		filter: (node) =>
			node.nodeType === 1 &&
			(node as Element).nodeName === "A" &&
			(hasAnchorAncestor(node) ||
				hasAnchorDescendant(node as Element) ||
				hasBlockDescendant(node as Element)),
		replacement: (_content, node) => {
			const el = node as Element;
			const text = normalizeLinkText(extractAnchorText(el));
			if (!text) return "";
			if (hasAnchorAncestor(el)) return escape(text);
			const href = el.getAttribute("href");
			if (!href) return escape(text);
			const title = el.getAttribute("title");
			const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : "";
			return `[${escape(text)}](${href}${titlePart})`;
		},
	});

	// 3) Remove ANY element whose (recursive) textContent is meaningless after cleanup
	turndown.addRule("dropMeaninglessElements", {
		filter: (node) => {
			if (node.nodeType !== 1) return false; // elements only
			const el = node as Element;

			// don't remove root containers
			if (el.nodeName === "HTML" || el.nodeName === "BODY") return false;

			// keep line-break-ish structural tags if you want
			if (el.nodeName === "BR" || el.nodeName === "HR") return false;

			// If it has any meaningful text, keep it.
			// (textContent is recursive: includes descendants)
			return isMeaninglessText(el.textContent ?? "");
		},
		replacement: () => "",
	});

	// 4) Also drop empty links created after image/text stripping: <a><img/></a> or <a>nbsp</a>
	turndown.addRule("dropEmptyLinks", {
		filter: (node) => {
			if (node.nodeType !== 1) return false;
			const el = node as Element;
			if (el.nodeName !== "A") return false;
			return isMeaninglessText(el.textContent ?? "");
		},
		replacement: () => "",
	});

	return turndown;
}

function hasAnchorAncestor(node: Node): boolean {
	let p: Node | null = node.parentNode;
	while (p) {
		if (p.nodeType === 1 && (p as Element).nodeName === "A") return true;
		p = p.parentNode;
	}
	return false;
}

function hasAnchorDescendant(node: Element): boolean {
	return node.getElementsByTagName("A").length > 0;
}

const BLOCK_TAGS = new Set([
	"ADDRESS",
	"ARTICLE",
	"ASIDE",
	"BLOCKQUOTE",
	"CANVAS",
	"DIV",
	"DL",
	"DT",
	"DD",
	"FIELDSET",
	"FIGCAPTION",
	"FIGURE",
	"FOOTER",
	"FORM",
	"H1",
	"H2",
	"H3",
	"H4",
	"H5",
	"H6",
	"HEADER",
	"HR",
	"LI",
	"MAIN",
	"NAV",
	"OL",
	"P",
	"PRE",
	"SECTION",
	"TABLE",
	"TBODY",
	"TD",
	"TFOOT",
	"TH",
	"THEAD",
	"TR",
	"UL",
]);

function hasBlockDescendant(node: Element): boolean {
	const stack: Element[] = [];
	for (let child = node.firstElementChild; child; child = child.nextElementSibling) {
		stack.push(child);
	}
	while (stack.length > 0) {
		const el = stack.pop()!;
		if (BLOCK_TAGS.has(el.tagName)) return true;
		for (let child = el.firstElementChild; child; child = child.nextElementSibling) {
			stack.push(child);
		}
	}
	return false;
}

function extractAnchorText(node: Element): string {
	const parts: string[] = [];
	const stack: Array<{ node: Node; exit: boolean }> = [{ node, exit: false }];
	const visited = new Set<Node>();
	while (stack.length > 0) {
		const { node: current, exit } = stack.pop()!;
		if (current.nodeType === 3) {
			parts.push(current.nodeValue ?? "");
			continue;
		}
		if (current.nodeType !== 1) continue;
		const el = current as Element;
		const isBlock = BLOCK_TAGS.has(el.tagName) || el.tagName === "BR";
		if (isBlock && exit) {
			parts.push(" ");
			continue;
		}
		if (exit) continue;
		if (visited.has(current)) continue;
		visited.add(current);
		if (isBlock) parts.push(" ");
		stack.push({ node: current, exit: true });
		for (let child = el.lastChild; child; child = child.previousSibling) {
			stack.push({ node: child, exit: false });
		}
	}
	return parts.join("");
}

function normalizeLinkText(s: string): string {
	// keep normal spaces, remove zero-width-ish chars (your existing policy)
	return s
		.replace(TEXT_INVISIBLE_RE, "")
		.replace(/\u00A0/g, " ")
		.replace(/\s+/g, " ")
		.trim();
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
	const headStyleBlocks = headStyles.map((style) => `<style>${style}</style>`).join("");

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
