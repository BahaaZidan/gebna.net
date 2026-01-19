export type ThumbnailQueueMessage = {
	type: "thumbnail";
	payload: {
		storageKey: string;
		mimeType?: string | null;
		filename?: string | null;
	};
};

export type InferAddressAvatarQueueMessage = {
	type: "infer-address-avatar";
	payload: {
		/** abc@example.com */
		address: string;
	};
};

export type QueueMessage = ThumbnailQueueMessage | InferAddressAvatarQueueMessage;
