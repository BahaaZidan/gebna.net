import type { Element, Root } from "hast";
import { toString as hastToString } from "hast-util-to-string";
import type { Declaration, Rule } from "postcss";
import safeParser from "postcss-safe-parser";
import type { Plugin } from "unified";
import { EXIT, visit } from "unist-util-visit";

type Palette = {
	bg: string;
	text: string;
	link: string;
	muted?: string;
	fontFamily?: string;
};

type Options = {
	palette: Palette;
	injectBaseCss?: boolean;
	force?: boolean;
};

function buildBaseCss(p: Palette): string {
	const font = p.fontFamily ?? "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
	return `html,body{background:${p.bg};color:${p.text};font-family:${font};}a{color:${p.link};}`;
}

function isLinkSelector(selector: string): boolean {
	return /(^|[\s>+~,])a(?=($|[\s>+~,.#:[\]]))/i.test(selector);
}

function isLinkDecl(decl: Declaration): boolean {
	const parent = decl.parent;
	return parent?.type === "rule" && isLinkSelector((parent as Rule).selector);
}

function rewriteDecl(decl: Declaration, palette: Palette, force: boolean, preferLinkColor: boolean): void {
	if (!force) return;

	const prop = decl.prop.toLowerCase();

	if (prop === "color") {
		decl.value = preferLinkColor ? palette.link : palette.text;
		return;
	}

	if (prop === "background" || prop === "background-color") {
		decl.value = palette.bg;
		return;
	}

	if (prop === "border-color" || prop === "outline-color" || prop === "text-decoration-color") {
		decl.value = palette.muted ?? palette.text;
		return;
	}

	if (prop === "fill" || prop === "stroke") {
		decl.value = palette.text;
	}
}

function rewriteStyleAttr(style: string, palette: Palette, force: boolean): string {
	if (!force) return style;

	const wrapped = `a{${style}}`;
	const root = safeParser(wrapped);

	root.walkDecls((decl) => rewriteDecl(decl, palette, force, false));

	const out = root.toString();
	const m = out.match(/^a\s*\{([\s\S]*)\}\s*$/);
	return m ? m[1].trim() : style;
}

function rewriteStyleTag(cssText: string, palette: Palette, force: boolean): string {
	if (!force) return cssText;

	const root = safeParser(cssText);
	root.walkDecls((decl) => rewriteDecl(decl, palette, force, isLinkDecl(decl)));

	return root.toString();
}

function findHeadElement(tree: Root): Element | null {
	let head: Element | null = null;

	visit(tree, "element", (node: Element) => {
		if (node.tagName !== "head") return;
		head = node;
		return EXIT;
	});

	return head;
}

function hasThemeStyle(head: Element): boolean {
	return head.children.some((child): boolean => {
		if (child.type !== "element" || child.tagName !== "style") return false;
		const properties = child.properties ?? {};
		return properties["data-gebna-theme"] === "1" || properties.dataGebnaTheme === "1";
	});
}

export const rehypeEnforcePalette: Plugin<[Options], Root> = (opts) => {
	const palette = opts.palette;
	const injectBaseCss = opts.injectBaseCss ?? true;
	const force = opts.force ?? false;

	return (tree) => {
		if (injectBaseCss) {
			const headEl = findHeadElement(tree);
			if (headEl && !hasThemeStyle(headEl)) {
				headEl.children.push({
					type: "element",
					tagName: "style",
					properties: { "data-gebna-theme": "1" },
					children: [{ type: "text", value: buildBaseCss(palette) }],
				});
			}
		}

		visit(tree, "element", (node: Element) => {
			const props = (node.properties ??= {});

			// legacy attrs
			if (typeof props.bgcolor === "string") props.bgcolor = palette.bg;
			if (typeof props.bgColor === "string") props.bgColor = palette.bg;
			if (typeof props.color === "string") props.color = palette.text;

			// inline style
			if (typeof props.style === "string" && props.style.trim()) {
				try {
					props.style = rewriteStyleAttr(props.style, palette, force);
				} catch {
					/* ignore */
				}
			}

			// links
			if (node.tagName === "a") {
				const s = typeof props.style === "string" ? props.style : "";
				if (force || !/(^|;)\s*color\s*:/i.test(s)) {
					props.style = s ? `${s};color:${palette.link}` : `color:${palette.link}`;
				}
			}

			// <style> tag
			if (node.tagName === "style") {
				const cssText = hastToString(node);
				if (cssText.trim()) {
					try {
						node.children = [{ type: "text", value: rewriteStyleTag(cssText, palette, force) }];
					} catch {
						/* ignore */
					}
				}
			}
		});
	};
};
