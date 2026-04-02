/**
 * Parameters for sending an e-mail message.
 */
export type PostalSendEmailBody = {
	/** The e-mail addresses of the recipients (max 50) */
	to?: string[] | null;

	/** The e-mail addresses of any CC contacts (max 50) */
	cc?: string[] | null;

	/** The e-mail addresses of any BCC contacts (max 50) */
	bcc?: string[] | null;

	/** The e-mail address for the From header */
	from?: string | null;

	/** The e-mail address for the Sender header */
	sender?: string | null;

	/** The subject of the e-mail */
	subject?: string | null;

	/** The tag of the e-mail */
	tag?: string | null;

	/** Set the reply-to address for the mail */
	reply_to?: string | null;

	/** The plain text body of the e-mail */
	plain_body?: string | null;

	/** The HTML body of the e-mail */
	html_body?: string | null;

	/** An array of attachments for this e-mail */
	attachments?: PostalAttachment[] | null;

	/** A hash of additional headers */
	headers?: Record<string, string> | null;

	/** Is this message a bounce? */
	bounce?: boolean | null;
};

type PostalAttachment = {
	name?: string;
	/** mime type */
	content_type?: string;
	/** Base-64 encoded attachment */
	data?: string;
};
