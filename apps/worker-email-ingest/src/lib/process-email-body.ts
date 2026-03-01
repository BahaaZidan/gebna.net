import { count } from "@wordpress/wordcount";
import type { Element, Root, RootContent } from "hast";
import { convert } from "html-to-text";
import type { Email } from "postal-mime";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkStringify from "remark-stringify";
import { unified, type Plugin } from "unified";

interface ProcessEmailBodyArguments {
	email: Email;
}

export async function processEmailBody({ email }: ProcessEmailBodyArguments): Promise<{
	html: string;
	plaintext: string;
	wordCount: number;
} | null> {
	const body = email.html ?? email.text;
	if (!body) return null;

	// 1) HTML -> (sanitize + normalize) -> Markdown
	const md = (
		await unified()
			.use(rehypeParse, { fragment: true })
			.use(rehypeSanitize, EMAIL_SANITIZE_SCHEMA)
			.use(rehypeEmailNormalize) // plugin (no parentheses)
			.use(rehypeRemark)
			.use(remarkGfm)
			.use(remarkStringify, {
				bullet: "-",
				fences: true,
				listItemIndent: "one",
			})
			.process(body)
	)
		.toString()
		.trim();

	// 2) Markdown -> HTML (this gives you the “CMS markdown article” look)
	const html = await markdownToHtml(md);

	// 3) Plaintext from Markdown (homogeneous)
	const plaintext = convert(html);

	return { html, plaintext, wordCount: count(plaintext, "words") };
}

/**
 * Tight schema: allow only “markdown-ish” HTML. No style/link/script/img/etc.
 * Also: no style/class/id attributes are allowed at all.
 */
const EMAIL_SANITIZE_SCHEMA = (() => {
	const schema = structuredClone(defaultSchema);

	schema.tagNames = [
		"p",
		"br",
		"hr",
		"blockquote",
		"pre",
		"code",
		"strong",
		"em",
		"b",
		"i",
		"u",
		"s",
		"del",
		"h1",
		"h2",
		"h3",
		"h4",
		"h5",
		"h6",
		"ul",
		"ol",
		"li",
		"a",
		"table",
		"thead",
		"tbody",
		"tfoot",
		"tr",
		"td",
		"th",

		// keep generic containers so we don’t lose text; we’ll unwrap them later
		"div",
		"span",
		"section",
		"article",
		"header",
		"footer",
	];

	schema.attributes = {
		a: ["href", "title"],
	};

	schema.strip = ["style", "script", "head", "link", "meta", "title"];

	schema.protocols = {
		a: ["http", "https", "mailto", "tel"],
	};

	return schema;
})();

type ElementChildren = Element["children"];
type ElementChild = ElementChildren[number];
type NormalizeContext = "normal" | "table";

/**
 * Rehype plugin:
 * - removes any remaining presentation attrs (belt + suspenders)
 * - removes images/svgs if any slipped in (belt + suspenders)
 * - unwraps container tags (div/span/section/...) to reduce clutter
 * - flattens <a> children to plain text
 * - drops empty/garbage blocks
 * - drops unsafe hrefs (javascript:, data:, etc.)
 */
export const rehypeEmailNormalize: Plugin<[], Root> = () => {
	return (tree) => {
		normalizeChildren(tree, "normal");
	};
};

const BLOCK_CONTAINER_TAGS = new Set(["div", "section", "article", "header", "footer"]);
const INLINE_CONTAINER_TAGS = new Set(["span"]);

const TABLE_CONTAINER_TAGS = new Set(["table", "thead", "tbody", "tfoot"]);
const TABLE_CELL_TAGS = new Set(["td", "th"]);
const INLINE_TRIM_TAGS = new Set(["strong", "em", "b", "i", "u", "s", "del"]);

const DROP_TAGS = new Set([
	"img",
	"svg",
	"picture",
	"source",
	"video",
	"audio",
	"canvas",
	"iframe",
	"object",
	"embed",
]);

const VOID_TAGS = new Set(["br", "hr"]);
const BLOCK_TAGS = new Set([
	"p",
	"blockquote",
	"pre",
	"ul",
	"ol",
	"li",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"hr",
]);

function normalizeChildren(parent: Root | Element, context: NormalizeContext): boolean {
	const next: ElementChildren = [];
	let hasContent = false;
	let lastWasBr = false;

	for (const child of parent.children) {
		if (child.type === "element") {
			const normalized = normalizeElement(child, context);
			if (!normalized) continue;

			if (Array.isArray(normalized)) {
				for (const item of normalized) {
					if (item.type === "element" && item.tagName === "br") {
						if (lastWasBr) continue;
						lastWasBr = true;
					} else if (item.type === "text" && !isMeaningfulText(item.value ?? "")) {
						// keep whitespace, but don't reset br tracking
					} else {
						lastWasBr = false;
					}
					next.push(item);
					if (addsContent(item)) hasContent = true;
				}
			} else {
				if (normalized.type === "element" && normalized.tagName === "br") {
					if (lastWasBr) continue;
					lastWasBr = true;
				} else if (normalized.type === "text" && !isMeaningfulText(normalized.value ?? "")) {
					// keep whitespace, but don't reset br tracking
				} else {
					lastWasBr = false;
				}
				next.push(normalized);
				if (addsContent(normalized)) hasContent = true;
			}
			continue;
		}

		if (child.type === "text") {
			const cleaned = normalizeTextValue(child.value ?? "");
			if (cleaned !== child.value) child.value = cleaned;
			next.push(child);
			if (isMeaningfulText(child.value)) {
				lastWasBr = false;
				hasContent = true;
			}
		}
	}

	parent.children = next;
	return hasContent;
}

function normalizeElement(
	node: Element,
	context: NormalizeContext
): ElementChild | ElementChild[] | null {
	stripPresentationAttrs(node);

	if (DROP_TAGS.has(node.tagName)) return null;

	if (VOID_TAGS.has(node.tagName)) {
		node.children = [];
		return node;
	}

	if (context === "normal" && node.tagName === "table") {
		return normalizeTable(node);
	}

	const hasContent = normalizeChildren(node, context);

	if (node.tagName === "a") {
		const href = typeof node.properties?.href === "string" ? node.properties.href : "";
		const rawText = normalizeTextValue(stripInvisibleChars(getText(node)));
		if (!isMeaningfulText(rawText)) return null;

		const inferredHref = href || inferHrefFromText(rawText);
		if (!inferredHref || !isSafeHref(inferredHref)) {
			return { type: "text", value: rawText };
		}

		node.properties = node.properties ?? {};
		node.properties.href = inferredHref;
		node.children = [{ type: "text", value: rawText }];
		return node;
	}

	if (INLINE_TRIM_TAGS.has(node.tagName)) {
		normalizeInlineElement(node);
		if (!hasInlineContent(node)) return null;
	}

	if (context === "table") {
		if (
			TABLE_CELL_TAGS.has(node.tagName) ||
			TABLE_CONTAINER_TAGS.has(node.tagName) ||
			node.tagName === "tr"
		) {
			return hasContent ? node : null;
		}
	} else {
		if (TABLE_CELL_TAGS.has(node.tagName) || TABLE_CONTAINER_TAGS.has(node.tagName)) {
			return hasContent ? node.children : null;
		}

		if (node.tagName === "tr") {
			if (!hasContent) return null;
			const children = node.children;
			return hasBlockChild(children)
				? children
				: {
						type: "element",
						tagName: "p",
						properties: {},
						children,
					};
		}
	}

	if (node.tagName === "p") {
		if (!hasParagraphContent(node)) return null;
	}

	if (BLOCK_CONTAINER_TAGS.has(node.tagName)) {
		if (!hasContent) return null;
		const children = node.children;
		return hasBlockChild(children)
			? children
			: {
					type: "element",
					tagName: "p",
					properties: {},
					children,
				};
	}

	if (INLINE_CONTAINER_TAGS.has(node.tagName)) {
		return hasContent ? node.children : null;
	}

	if (!hasContent) return null;

	return node;
}

function normalizeTable(node: Element): ElementChild | ElementChild[] | null {
	const isData = isDataTable(node);
	if (!isData) {
		const hasContent = normalizeChildren(node, "normal");
		return hasContent ? node.children : null;
	}

	const hasContent = normalizeChildren(node, "table");
	return hasContent ? node : null;
}

function stripPresentationAttrs(node: Element) {
	const props = node.properties;
	if (!props) return;

	// no styling hooks
	delete props.style;
	delete props.className;
	delete props.id;

	// common presentation attrs in emails
	delete props.width;
	delete props.height;
	delete props.bgcolor;
	delete props.align;
	delete props.valign;
	delete props.border;
}

function getText(node: RootContent): string {
	if (node.type === "text") return node.value ?? "";
	if (node.type === "element") {
		let out = "";
		for (const child of node.children) {
			out += getText(child);
		}
		return out;
	}
	return "";
}

function addsContent(node: ElementChild): boolean {
	if (node.type === "text") return isMeaningfulText(node.value);
	return node.type === "element";
}

function hasBlockChild(children: ElementChildren): boolean {
	for (const child of children) {
		if (child.type === "element" && BLOCK_TAGS.has(child.tagName)) return true;
	}
	return false;
}

function isDataTable(table: Element): boolean {
	let hasHeader = false;
	let hasNumber = false;
	let hasLabelAndNumberRow = false;
	const rowCounts: number[] = [];

	const rows: Element[] = [];
	const stack: Element[] = [table];

	while (stack.length) {
		const current = stack.pop();
		if (!current) break;

		for (const child of current.children) {
			if (child.type !== "element") continue;

			if (child.tagName === "table" && current !== table) {
				continue;
			}

			if (child.tagName === "thead") hasHeader = true;
			if (child.tagName === "tr") rows.push(child);

			stack.push(child);
		}
	}

	for (const row of rows) {
		let cellCount = 0;
		let rowHasNumber = false;
		let rowHasLabel = false;

		for (const cell of row.children) {
			if (cell.type !== "element") continue;
			if (cell.tagName !== "td" && cell.tagName !== "th") continue;

			if (cell.tagName === "th") hasHeader = true;

			const text = normalizeInvisible(getTextExcludingTables(cell));
			if (!text) continue;

			cellCount += 1;
			if (/\d/.test(text)) {
				rowHasNumber = true;
				hasNumber = true;
			}
			if (/[A-Za-z]/.test(text)) {
				rowHasLabel = true;
			}
		}

		if (cellCount > 0) {
			rowCounts.push(cellCount);
			if (cellCount >= 2 && rowHasNumber && rowHasLabel) hasLabelAndNumberRow = true;
		}
	}

	const dataRowCounts = rowCounts.filter((count) => count >= 2);
	if (dataRowCounts.length === 0) return false;

	const countByColumns = new Map<number, number>();
	for (const count of dataRowCounts) {
		countByColumns.set(count, (countByColumns.get(count) ?? 0) + 1);
	}

	const hasConsistentColumns = Array.from(countByColumns.values()).some((value) => value >= 2);

	if (hasHeader || hasLabelAndNumberRow) return true;
	if (hasConsistentColumns && hasNumber) return true;

	return false;
}

function getTextExcludingTables(node: RootContent): string {
	if (node.type === "text") return node.value ?? "";
	if (node.type === "element") {
		if (node.tagName === "table") return "";
		let out = "";
		for (const child of node.children) {
			out += getTextExcludingTables(child);
		}
		return out;
	}
	return "";
}

function isMeaningfulText(value: string): boolean {
	return normalizeInvisible(value).length > 0;
}

function normalizeInvisible(input: string): string {
	// remove zero-width & friends
	const stripped = stripInvisibleChars(input).trim();

	// treat “only hyphens/whitespace” as empty
	return stripped.replace(/[-\s\u00ad\u2010-\u2015\u2212]+/g, "").length === 0 ? "" : stripped;
}

function stripInvisibleChars(input: string): string {
	return input.replace(/[\u034f\u200b-\u200f\u2060\ufeff]/g, "");
}

function normalizeTextValue(input: string): string {
	return normalizeLinebreakEntities(input);
}

function normalizeLinebreakEntities(input: string): string {
	return input.replace(/&(?:amp;)?#x0*(?:a|d);?|&(?:amp;)?#0*(?:10|13);?/gi, " ");
}

function normalizeInlineElement(node: Element) {
	const next: ElementChildren = [];

	for (const child of node.children) {
		if (child.type === "text") {
			const normalized = normalizeInlineText(child.value ?? "");
			child.value = normalized;
			next.push(child);
			continue;
		}

		if (child.type === "element" && child.tagName === "br") {
			next.push({ type: "text", value: " " });
			continue;
		}

		next.push(child);
	}

	node.children = next;
}

function normalizeInlineText(value: string): string {
	return value.replace(/\u00a0/g, " ").replace(/[\t\r\n]+/g, " ");
}

function hasInlineContent(node: Element): boolean {
	for (const child of node.children) {
		if (child.type === "text" && isMeaningfulText(child.value)) return true;
		if (child.type === "element") return true;
	}
	return false;
}

function hasParagraphContent(node: Element): boolean {
	for (const child of node.children) {
		if (child.type === "text" && isMeaningfulText(child.value)) return true;
		if (child.type === "element" && child.tagName !== "br") return true;
	}
	return false;
}

function isSafeHref(href: string): boolean {
	// allow relative and in-page links
	if (href.startsWith("/") || href.startsWith("#")) return true;

	// allow mailto/tel/http/https only
	try {
		const u = new URL(href);
		return (
			u.protocol === "http:" ||
			u.protocol === "https:" ||
			u.protocol === "mailto:" ||
			u.protocol === "tel:"
		);
	} catch {
		return false;
	}
}

function inferHrefFromText(text: string): string | null {
	const match = text.match(/(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+)/i);
	if (!match) return null;

	let url = match[0];
	url = url.replace(/[),.;:!?]+$/g, "");
	if (url.startsWith("www.")) url = `https://${url}`;
	return url;
}

async function markdownToHtml(md: string): Promise<string> {
	return String(
		await unified()
			.use(remarkParse)
			.use(remarkGfm)
			.use(remarkRehype)
			.use(rehypeAddTargetBlank)
			.use(rehypeStringify)
			.process(md)
	);
}

const rehypeAddTargetBlank: Plugin<[], Root> = () => {
	return (tree) => {
		addTargetBlank(tree);
	};
};

function addTargetBlank(node: Root | Element) {
	for (const child of node.children) {
		if (child.type === "element") {
			if (child.tagName === "a") {
				child.properties = child.properties ?? {};
				child.properties.target = "_blank";
				child.properties.rel = "noopener noreferrer";
			}
			addTargetBlank(child);
		}
	}
}
