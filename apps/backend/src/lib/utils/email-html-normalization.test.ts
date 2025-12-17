import assert from "node:assert/strict";
import test from "node:test";
import type { Email } from "postal-mime";

import { normalizeAndSanitizeEmailBody } from "./email-html-normalization";

const baseEmail: Email = {
	headers: [],
	attachments: [],
};

test("empty email produces minimal document", () => {
	const result = normalizeAndSanitizeEmailBody({ ...baseEmail, html: "", text: "" });
	assert.equal(result.kind, "empty");
	assert.ok(result.htmlDocument.includes("<!doctype html>"));
	assert.ok(result.htmlDocument.includes("No content"));
	assert.equal(result.flags.hadHtml, false);
	assert.equal(result.flags.hadText, false);
});

test("text-only email converts to html with line breaks", () => {
	const result = normalizeAndSanitizeEmailBody({ ...baseEmail, text: "Hello\nWorld" });
	assert.equal(result.kind, "text");
	assert.ok(result.htmlDocument.includes("Hello<br>World"));
	assert.equal(result.text, "Hello\nWorld");
});

test("html fragment is wrapped and preserved", () => {
	const result = normalizeAndSanitizeEmailBody({ ...baseEmail, html: "<div>Hello</div>" });
	assert.equal(result.kind, "html");
	assert.ok(result.htmlDocument.includes("<div>Hello</div>"));
	assert.ok(result.htmlDocument.startsWith("<!doctype html>"));
});

test("full html document extracts head styles", () => {
	const result = normalizeAndSanitizeEmailBody({
		...baseEmail,
		html: "<html><head><style>body{color:red;}</style></head><body><p>Hi</p></body></html>",
	});
	assert.ok(result.htmlDocument.includes("<style>body{color:red;}</style>"));
	assert.ok(result.htmlDocument.includes("<p>Hi</p>"));
});

test("malformed html is tolerated and flagged", () => {
	const result = normalizeAndSanitizeEmailBody({ ...baseEmail, html: "<div" });
	assert.equal(result.flags.wasMalformedHtml, true);
});

test("scripts and event handlers are stripped", () => {
	const result = normalizeAndSanitizeEmailBody({
		...baseEmail,
		html: '<div onclick="alert(1)"><script>alert(1)</script>Hi</div>',
	});
	assert.equal(result.flags.strippedScripts, true);
	assert.equal(result.flags.strippedEventHandlers, true);
	assert.ok(!result.htmlDocument.includes("script"));
	assert.ok(result.htmlDocument.includes("Hi"));
});

test("remote images are blocked by default", () => {
	const result = normalizeAndSanitizeEmailBody({
		...baseEmail,
		html: '<img src="http://example.com/a.png">',
	});
	assert.equal(result.flags.hasRemoteImages, true);
	assert.equal(result.flags.blockedRemoteImages, true);
	assert.ok(!result.htmlDocument.includes("example.com"));
});

test("cid urls are rewritten when resolver is provided", () => {
	const result = normalizeAndSanitizeEmailBody(
		{ ...baseEmail, html: '<img src="cid:abc">' },
		{ cidResolver: (cid) => (cid === "abc" ? "https://example.com/abc.png" : null) }
	);
	assert.equal(result.flags.rewroteCidUrls, true);
	assert.ok(result.htmlDocument.includes("https://example.com/abc.png"));
});
