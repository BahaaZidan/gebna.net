import * as cheerio from "cheerio";
import he from "he";
import type { Email } from "postal-mime";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
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

	// TODO: strip layout tables
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
	let html = makeItEvenBetter(markdownHTML);

	return {
		html,
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

function makeItEvenBetter(markdownHTML: string) {
	const $ = cheerio.load(markdownHTML);

	$("p, div").each((_, node) => {
		const p = $(node);
		const textContent = p.text();
		if (isHyphenOrWhitespaceOnly(textContent)) p.remove();
	});

	const result = $.html();
	return result;
}

function isHyphenOrWhitespaceOnly(text: string): boolean {
	const decoded = he.decode(text);
	if (decoded.length === 0) return true;

	for (const char of decoded) {
		if (HYPHEN_CHARS.has(char)) continue;
		if (INVISIBLE_CHARS.has(char)) continue;
		if (char.trim().length === 0) continue;
		return false;
	}

	return true;
}

const HYPHEN_CHARS = new Set([
	"-",
	"\u00ad",
	"\u2010",
	"\u2011",
	"\u2012",
	"\u2013",
	"\u2014",
	"\u2015",
	"\u2212",
]);

const INVISIBLE_CHARS = new Set([
	"\u034f", // combining grapheme joiner
	"\u200b", // zero-width space
	"\u200c", // zero-width non-joiner
	"\u200d", // zero-width joiner
	"\u200e", // left-to-right mark
	"\u200f", // right-to-left mark
	"\u2060", // word joiner
	"\ufeff", // zero-width no-break space
]);
