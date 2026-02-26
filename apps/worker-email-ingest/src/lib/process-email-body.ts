import * as cheerio from "cheerio";

import type {} from "cheerio";

import { gfmToMarkdown } from "mdast-util-gfm";
import { NodeHtmlMarkdown, NodeHtmlMarkdownOptions } from "node-html-markdown";
import type { Email } from "postal-mime";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkStringify from "remark-stringify";
import sanitizeHtml, { type IOptions } from "sanitize-html";
import TurndownService from "turndown";
import { unified } from "unified";

interface ProcessEmailBodyArguments {
	email: Email;
}
export async function processEmailBody({
	email,
}: ProcessEmailBodyArguments): Promise<{ html: string; plaintext: string } | null> {
	const body = email.html || email.text;
	if (!body) return null;

	// TODO: strip layout tables and nested anchor tags
	let sanitizedBody = sanitizeHtml(body, {
		allowedTags,
		allowedAttributes,
		enforceHtmlBoundary: true,
	});

	let plaintext = sanitizeHtml(body, {
		allowedTags: [],
		allowedAttributes: {},
		textFilter(text) {
			return text.trim();
		},
	});
	let betterBody = makeItBetter(sanitizedBody);
	let markdownHTML = await htmlToMarkdownHTML(betterBody);

	return {
		html: markdownHTML,
		plaintext,
	};
}
type AllowedAttributes = NonNullable<IOptions["allowedAttributes"]>;
type AllowedTags = Exclude<NonNullable<IOptions["allowedTags"]>, false>;

const allowedAttributes = {
	a: ["href", "title"],
	abbr: ["title"],
	address: [],
	article: [],
	aside: [],
	b: [],
	bdi: ["dir"],
	bdo: ["dir"],
	big: [],
	blockquote: ["cite"],
	br: [],
	caption: [],
	center: [],
	cite: [],
	code: [],
	col: ["align", "valign", "span", "width"],
	colgroup: ["align", "valign", "span", "width"],
	dd: [],
	del: ["datetime"],
	details: ["open"],
	div: [],
	dl: [],
	dt: [],
	em: [],
	figcaption: [],
	figure: [],
	font: ["color", "size", "face"],
	footer: [],
	h1: [],
	h2: [],
	h3: [],
	h4: [],
	h5: [],
	h6: [],
	header: [],
	hr: [],
	i: [],
	ins: ["datetime"],
	kbd: [],
	li: [],
	mark: [],
	nav: [],
	ol: [],
	p: [],
	pre: [],
	s: [],
	section: [],
	small: [],
	span: [],
	sub: [],
	summary: [],
	sup: [],
	strong: [],
	strike: [],
	table: ["width", "border", "align", "valign"],
	tbody: ["align", "valign"],
	td: ["width", "rowspan", "colspan", "align", "valign"],
	tfoot: ["align", "valign"],
	th: ["width", "rowspan", "colspan", "align", "valign"],
	thead: ["align", "valign"],
	tr: ["rowspan", "align", "valign"],
	tt: [],
	u: [],
	ul: [],
} satisfies AllowedAttributes;

const allowedTags: AllowedTags = Object.keys(allowedAttributes);

function makeItBetter(sanitizedBody: string): string {
	const $ = cheerio.load(sanitizedBody);

	// Flatten anchor tags
	$("a").each((_, anchor) => {
		const $a = $(anchor);
		const href = $a.attr("href");
		const text = $a.text();
		$a.text(text);
		if (href) $a.attr("href", href);
	});

	// Remove all whitespace-only or zero-width elements
	const INVISIBLE_TEXT_RE = /[\u200B-\u200D\uFEFF]/g;
	$("*").each((_, node) => {
		if (node.type !== "tag") return;
		const tag = node.name;
		if (tag === "html" || tag === "body") return;
		const rawText = $(node).text();
		const cleaned = rawText
			.replace(INVISIBLE_TEXT_RE, "")
			.replace(/\u00A0/g, " ")
			.trim();
		if (!cleaned) $(node).remove();
	});

	const result = $.html();
	return result;
}

async function htmlToMarkdownHTML(body: string) {
	const turndown = new TurndownService({});
	const md = turndown.turndown(body);

	const resultHTML = (
		await unified()
			.use(remarkParse)
			.use(remarkGfm)
			.use(remarkRehype)
			.use(rehypeStringify)
			.process(md)
	).toString();

	return resultHTML;
}
