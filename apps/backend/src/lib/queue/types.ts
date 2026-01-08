export type ThumbnailQueueMessage = {
	type: "thumbnail";
	payload: {
		storageKey: string;
		mimeType?: string | null;
		filename?: string | null;
	};
};

export type ContactAvatarQueueMessage = {
	type: "contact-avatar";
	payload: {
		contactId: string;
	};
};

export type QueueMessage = ThumbnailQueueMessage | ContactAvatarQueueMessage;
