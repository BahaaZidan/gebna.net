import { createPubSub } from "graphql-yoga";

type PubSubPayloads = {
	messageAdded: [{ conversationId: string; messageId: string }];
	deliveryUpdated: [{ messageId: string }];
	conversationUpdated: [{ conversationId: string }];
};

export const pubsub = createPubSub<PubSubPayloads>();
