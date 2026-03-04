import { count, rehypeParse, rehypeSanitize, rehypeStringify, unified } from "@gebna/utils";
import type {
	HastElement,
	HastElementContent,
	HastRoot,
	HastRootContent,
	RehypeSanitizeOptions,
	UnifiedPlugin,
} from "@gebna/utils";
import { convert } from "html-to-text";
import type { Email } from "postal-mime";

interface ProcessEmailBodyArguments {
	email: Email;
}

export async function processEmailBody({ email }: ProcessEmailBodyArguments): Promise<{
	html?: string;
	plaintext?: string;
	wordCount?: number;
} | null> {
	if (!email.html && !email.text) return null;
	if (email.text && !email.html)
		return { plaintext: email.text, wordCount: count(email.text, "words") };
	if (!email.html) return null;

	const html = (
		await unified()
			.use(rehypeParse, { fragment: false })
			.use(rehypeSanitize, EMAIL_SANITIZE_SCHEMA)
			.use(rehypeEnsureFullDocumentWithBaseStyles)
			.use(rehypeStringify)
			.process(email.html)
	)
		.toString()
		.trim();

	const plaintext = convert(html).trim();
	return { html, plaintext, wordCount: count(plaintext, "words") };
}

const BASE_EMAIL_STYLE = "html, body { font-family: Inter, sans-serif; margin: 0; padding: 0; }";

const rehypeEnsureFullDocumentWithBaseStyles: UnifiedPlugin<[], HastRoot> = () => (tree) => {
	ensureFullDocumentWithBaseStyles(tree);
};

function ensureFullDocumentWithBaseStyles(root: HastRoot) {
	const rootChildren = root.children;
	const htmlNode = rootChildren.find((node): node is HastElement => isElementWithTag(node, "html"));

	if (!htmlNode) {
		root.children = [
			createElement("html", [
				createElement("head", [createBaseStyleNode()]),
				createElement(
					"body",
					rootChildren.flatMap((node) => rootContentToBodyContent(node))
				),
			]),
		];
		return;
	}

	const strayNodes = rootChildren.filter((node) => node !== htmlNode);
	if (strayNodes.length > 0) {
		root.children = [htmlNode];
	}

	let headNode = findChildElementByTagName(htmlNode, "head");
	let bodyNode = findChildElementByTagName(htmlNode, "body");

	if (!headNode) {
		headNode = createElement("head", []);
		htmlNode.children.unshift(headNode);
	}

	if (!bodyNode) {
		const remainingChildren = htmlNode.children.filter((node) => node !== headNode);
		bodyNode = createElement("body", remainingChildren);
		htmlNode.children = [headNode, bodyNode];
	}

	if (strayNodes.length > 0) {
		bodyNode.children = [
			...bodyNode.children,
			...strayNodes.flatMap((node) => rootContentToBodyContent(node)),
		];
	}

	const hasBaseStyle = headNode.children.some(
		(node): node is HastElement =>
			isElementWithTag(node, "style") && node.properties.dataEmailIngestBase === "true"
	);

	if (!hasBaseStyle) {
		headNode.children.push(createBaseStyleNode());
	}
}

function createBaseStyleNode(): HastElement {
	return {
		type: "element",
		tagName: "style",
		properties: { dataEmailIngestBase: "true" },
		children: [{ type: "text", value: BASE_EMAIL_STYLE }],
	};
}

function createElement(tagName: string, children: HastElementContent[]): HastElement {
	return { type: "element", tagName, properties: {}, children };
}

function findChildElementByTagName(parent: HastElement, tagName: string): HastElement | undefined {
	return parent.children.find((node): node is HastElement => isElementWithTag(node, tagName));
}

function isElementWithTag(
	node: HastRootContent | HastElementContent,
	tagName: string
): node is HastElement {
	return node.type === "element" && node.tagName === tagName;
}

function rootContentToBodyContent(node: HastRootContent): HastElementContent[] {
	return node.type === "doctype" ? [] : [node];
}

const EMAIL_SANITIZE_SCHEMA: RehypeSanitizeOptions = {
	allowComments: false,
	allowDoctypes: false,
	ancestors: {
		area: ["map"],
		caption: ["table"],
		col: ["colgroup"],
		colgroup: ["table"],
		dd: ["dl"],
		dt: ["dl"],
		legend: ["fieldset"],
		li: ["ol", "ul", "menu"],
		rp: ["ruby"],
		rt: ["ruby"],
		tbody: ["table"],
		td: ["tr"],
		tfoot: ["table"],
		th: ["tr"],
		thead: ["table"],
		tr: ["table", "tbody", "thead", "tfoot"],
	},
	attributes: {
		"*": [
			"abbr",
			"align",
			"ariaDescribedBy",
			"ariaHidden",
			"ariaLabel",
			"ariaLabelledBy",
			"axis",
			"bgColor",
			"border",
			"cellPadding",
			"cellSpacing",
			"char",
			"charOff",
			"className",
			"clear",
			"colSpan",
			"color",
			"cols",
			"compact",
			"data*",
			"dateTime",
			"dir",
			"height",
			"hidden",
			"hSpace",
			"id",
			"lang",
			"maxLength",
			"name",
			"noWrap",
			"open",
			"rel",
			"rev",
			"role",
			"rowSpan",
			"rows",
			"scope",
			"size",
			"span",
			"start",
			"style",
			"summary",
			"tabIndex",
			"title",
			"vAlign",
			"value",
			"vSpace",
			"width",
		],
		a: ["href", "name", "target", "rel", "title"],
		area: ["href", "alt", "coords", "shape", "target", "rel"],
		audio: ["src", "controls", "loop", "muted", "autoPlay", "preload"],
		blockquote: ["cite"],
		button: ["name", "value", "disabled", ["type", "button", "reset"]],
		del: ["cite", "dateTime"],
		img: ["src", "alt", "title", "width", "height", "srcSet", "loading", "decoding"],
		ins: ["cite", "dateTime"],
		label: ["htmlFor"],
		link: ["href", "rel", "media", "type"],
		meta: ["name", "content", "httpEquiv", "charSet"],
		ol: ["start", "reversed", "type"],
		q: ["cite"],
		source: ["src", "srcSet", "type", "media"],
		style: ["media"],
		table: ["width", "height", "align", "summary", "cellPadding", "cellSpacing", "border"],
		td: ["colSpan", "rowSpan", "headers", "scope", "width", "height", "align", "vAlign"],
		th: ["colSpan", "rowSpan", "headers", "scope", "width", "height", "align", "vAlign"],
		time: ["dateTime"],
		video: [
			"src",
			"poster",
			"controls",
			"width",
			"height",
			"muted",
			"loop",
			"autoPlay",
			"playsInline",
			"preload",
		],
	},
	clobber: ["id", "name"],
	clobberPrefix: "user-content-",
	protocols: {
		cite: ["http", "https"],
		href: ["http", "https", "mailto", "tel"],
		poster: ["http", "https", "cid", "data"],
		src: ["http", "https", "cid", "data"],
		srcSet: ["http", "https", "cid", "data"],
		xlinkHref: ["http", "https"],
	},
	required: {},
	strip: ["script", "iframe", "frame", "frameset", "object", "embed", "applet"],
	tagNames: [
		"a",
		"abbr",
		"address",
		"area",
		"article",
		"aside",
		"audio",
		"b",
		"bdi",
		"bdo",
		"blockquote",
		"body",
		"br",
		"button",
		"caption",
		"cite",
		"code",
		"col",
		"colgroup",
		"data",
		"dd",
		"del",
		"details",
		"dfn",
		"div",
		"dl",
		"dt",
		"em",
		"fieldset",
		"figcaption",
		"figure",
		"footer",
		"h1",
		"h2",
		"h3",
		"h4",
		"h5",
		"h6",
		"head",
		"header",
		"hgroup",
		"hr",
		"html",
		"i",
		"img",
		"ins",
		"kbd",
		"label",
		"legend",
		"li",
		"link",
		"main",
		"map",
		"mark",
		"menu",
		"meta",
		"nav",
		"ol",
		"p",
		"picture",
		"pre",
		"progress",
		"q",
		"rp",
		"rt",
		"ruby",
		"s",
		"samp",
		"section",
		"small",
		"source",
		"span",
		"strong",
		"style",
		"sub",
		"summary",
		"sup",
		"table",
		"tbody",
		"td",
		"template",
		"tfoot",
		"th",
		"thead",
		"time",
		"title",
		"tr",
		"u",
		"ul",
		"var",
		"video",
		"wbr",
	],
};
