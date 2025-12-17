# Email HTML Normalization & Sanitization Pipeline Spec

This document defines the requirements for a backend function that normalizes and sanitizes
email bodies parsed using **PostalMime**. The output is intended to be rendered **only**
inside a sandboxed iframe on the frontend.

---

## Function: `normalizeAndSanitizeEmailBody`

### Purpose
Convert untrusted email content into a **safe, deterministic, full HTML document**
that the frontend can render without additional parsing or sanitization.

The frontend must be able to assume:
- HTML is always valid
- HTML is always a full document (`<!doctype><html><head><body>`)
- No scripts, active content, or style leakage is possible

---

## Input

### Parsed Email
The function receives the result of `PostalMime.parse()`.

Relevant fields:
- `html?: string`
- `text?: string`
- `attachments?: Attachment[]`

### Options (optional)
```ts
{
  maxHtmlBytes?: number;            // default: 1_000_000
  maxTextBytes?: number;            // default: 300_000
  blockRemoteImagesByDefault?: boolean; // default: true
  allowDataImages?: boolean;        // default: false
  keepHeadStyleTags?: boolean;      // default: true
  stripInlineStyleAttributes?: boolean; // default: false
  cidResolver?: (cid: string) => string | null;
  remoteImagePlaceholder?: string;
}
```

---

## Output

```ts
type NormalizedEmailBody = {
  kind: "html" | "text" | "empty";
  htmlDocument: string;  // ALWAYS a full HTML document
  text: string;          // plaintext fallback
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
```

---

## Required Behavior

### 1. Content Selection
- Prefer HTML if present.
- If HTML is missing, convert text to HTML.
- If both are missing or empty, return a minimal “No content” document.

### 2. Size Limits
- Enforce byte limits on input HTML/text.
- Truncate safely and record warnings.

### 3. HTML Parsing & Normalization
- Treat HTML as possibly:
  - Full document
  - Fragment
  - Malformed
- Parse robustly; must not throw.
- Extract:
  - `body.innerHTML`
  - `<style>` tags from `<head>` (no external stylesheets)
- Always wrap in a controlled shell:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <!-- extracted <style> tags -->
    <style>
      html, body { margin: 0; padding: 0; }
      body { overflow-wrap: anywhere; word-break: break-word; }
      img { max-width: 100%; height: auto; }
      table { max-width: 100%; }
    </style>
  </head>
  <body><!-- sanitized body --></body>
</html>
```

---

## 4. Sanitization Rules (Mandatory)

### Remove entirely:
- `<script>`
- `<iframe>`
- `<frame>`, `<frameset>`
- `<object>`, `<embed>`, `<applet>`
- `<form>`, `<input>`, `<button>`, `<textarea>`, `<select>`, `<option>`
- `<video>`, `<audio>`, `<source>`, `<track>`
- `<portal>`
- `<base>`
- `<meta http-equiv="refresh">`
- `<link>` (unless explicitly allowed)

### Attributes:
- Remove all `on*` event handlers.
- Neutralize dangerous URL schemes in all URL-bearing attributes:
  - `javascript:`
  - `vbscript:`
  - `file:`
  - `data:` (except `data:image/*` if allowed)

### Inline styles:
- If `stripInlineStyleAttributes=true`, remove all `style=""`.

---

## 5. Remote Images
- Detect `img[src^="http"]`.
- Set `hasRemoteImages=true` if found.
- If blocking:
  - Remove or replace with `remoteImagePlaceholder`.
  - Set `blockedRemoteImages=true`.

---

## 6. CID Images
- Detect `img[src^="cid:"]`.
- If `cidResolver` exists:
  - Rewrite to returned URL.
  - Set `rewroteCidUrls=true`.
- Otherwise, remove the image.

---

## 7. Links
- Keep safe `<a href>`.
- Strip unsafe URLs.
- Recommended: add `rel="noreferrer noopener"` and `target="_blank"`.

---

## 8. Text-to-HTML Conversion
- Escape all HTML entities.
- Preserve line breaks (`<pre>` or `<br>`).
- Wrap using the same controlled HTML shell.

---

## 9. Performance Constraints
- Linear-time behavior relative to input size.
- No regex-only HTML parsing.
- Single parse + single traversal for sanitization.
- Safe for serverless runtimes (e.g. Cloudflare Workers).

---

## 10. Determinism
- Same input + options → same output bytes.
- Warnings must be stable short codes.

---

## Explicit Non-Goals
- Pixel-perfect fidelity with all email clients.
- Loading or inlining remote CSS.
- Executing or emulating JavaScript.

---

## Required Tests
The implementation must include tests for:
- Empty email
- Text-only email
- HTML fragment
- Full HTML document
- Malformed HTML
- Script and event-handler stripping
- Remote image blocking
- CID rewriting

---

## Frontend Assumption
The frontend will render `htmlDocument` ONLY inside:

```html
<iframe sandbox="" referrerpolicy="no-referrer" srcdoc={htmlDocument}></iframe>
```

No additional sanitization or parsing will occur on the client.
