import type { Email } from "postal-mime";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import sanitizeHtml from "sanitize-html";
import TurndownService from "turndown";
import { unified } from "unified";
import xss, { type IWhiteList } from "xss";

interface ProcessEmailBodyArguments {
	email: Email;
}
export async function processEmailBody({
	email,
}: ProcessEmailBodyArguments): Promise<{ html: string; plaintext: string } | null> {
	const body = email.html || email.text;
	if (!body) return null;

	// TODO: strip layout tables and nested anchor tags
	let sanitizedBody = xss(body, {
		allowList,
		allowCommentTag: false,
	});
	let plaintext = sanitizeHtml(body, {
		allowedTags: [],
		allowedAttributes: {},
		textFilter(text) {
			return text.trim();
		},
	});
	let markdownHTML = await htmlToMarkdownHTML(sanitizedBody);

	return {
		html: markdownHTML,
		plaintext,
	};
}

const allowList: IWhiteList = {
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
};

async function htmlToMarkdownHTML(body: string) {
	const turndown = new TurndownService();
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
