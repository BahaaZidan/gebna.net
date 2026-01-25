import { createPubSub } from "graphql-yoga";

type PubSubPayload = { conversationId: string; messageId?: string };

type PubSubPayloads = {
	messageAdded: [PubSubPayload];
	deliveryUpdated: [PubSubPayload];
	conversationUpdated: [PubSubPayload];
};

type ConversationEventName = keyof PubSubPayloads;

export type ConversationEventEnvelope<TName extends ConversationEventName = ConversationEventName> =
	{
		type: TName;
		conversationId: string;
		payload: PubSubPayloads[TName][0];
		seq?: number;
		sourceId?: string;
	};

type PublishEnvelope = ConversationEventEnvelope;

const RECONNECT_DELAY_MS = 1_000;
const IDLE_CLOSE_DELAY_MS = 30_000;

class ConversationEventConnection {
	private socket: WebSocket | null = null;
	private connecting: Promise<void> | null = null;
	private subscriberCount = 0;
	private idleTimeout: ReturnType<typeof setTimeout> | null = null;
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private readonly conversationId: string,
		private readonly env: CloudflareBindings,
		private readonly onRemoteEvent: (envelope: PublishEnvelope) => Promise<void> | void,
		private readonly getExecutionCtx: () => ExecutionContextLike | undefined
	) {}

	addSubscriber() {
		this.subscriberCount += 1;
		this.clearIdleTimer();
		this.ensureSocket();
	}

	removeSubscriber() {
		this.subscriberCount = Math.max(0, this.subscriberCount - 1);
		if (!this.subscriberCount) {
			this.scheduleIdleClose();
		}
	}

	isIdle() {
		return this.subscriberCount === 0;
	}

	private async ensureSocket() {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
		if (this.connecting) return this.connecting;

		this.connecting = this.openSocket().finally(() => {
			this.connecting = null;
		});
		return this.connecting;
	}

	private async openSocket() {
		try {
			const stub = this.env.CONVERSATION_EVENTS.get(
				this.env.CONVERSATION_EVENTS.idFromName(this.conversationId)
			);
			const request = new Request(`https://conversation-events/${this.conversationId}`, {
				headers: {
					Upgrade: "websocket",
					"X-Conversation-Events-Secret": this.env.CONVERSATION_EVENTS_SECRET,
				},
			});
			const response = await stub.fetch(request);
			const ws = response.webSocket;
			if (!ws) throw new Error("Conversation events DO did not return a WebSocket");

			ws.accept();
			this.socket = ws;
			ws.addEventListener("message", (event) => this.handleMessage(event));
			ws.addEventListener("close", () => this.handleClose());
			ws.addEventListener("error", () => this.handleClose());
		} catch (error) {
			console.error("Failed to connect to conversation events DO", error);
			this.scheduleReconnect();
		}
	}

	private handleMessage(event: MessageEvent) {
		if (typeof event.data !== "string") return;
		const envelope = parseEventEnvelope(event.data);
		if (!envelope) return;
		if (envelope.conversationId !== this.conversationId) return;
		// Do not drop self-originated events; we rely on DO echo for local delivery.

		this.onRemoteEvent(envelope);
	}

	private handleClose() {
		if (this.socket && this.socket.readyState === WebSocket.CLOSED) {
			this.socket = null;
		}

		if (this.subscriberCount) {
			this.scheduleReconnect();
		} else {
			this.closeSocket();
		}
	}

	private scheduleReconnect() {
		if (this.reconnectTimeout !== null) return;
		const reconnectPromise = new Promise<void>((resolve) => {
			this.reconnectTimeout = setTimeout(() => {
				this.reconnectTimeout = null;
				resolve();
			}, RECONNECT_DELAY_MS);
		}).then(() => this.ensureSocket());

		const executionCtx = this.getExecutionCtx();
		if (executionCtx) {
			executionCtx.waitUntil(reconnectPromise);
		}
	}

	private scheduleIdleClose() {
		if (this.idleTimeout !== null) return;
		this.idleTimeout = setTimeout(() => {
			this.closeSocket();
		}, IDLE_CLOSE_DELAY_MS);
	}

	private clearIdleTimer() {
		if (this.idleTimeout !== null) {
			clearTimeout(this.idleTimeout);
			this.idleTimeout = null;
		}
	}

	private closeSocket() {
		if (this.socket) {
			try {
				this.socket.close();
			} catch {
				// ignore
			}
		}
		this.socket = null;
		this.clearIdleTimer();
		if (this.reconnectTimeout !== null) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
	}
}

class ConversationEventHub {
	private readonly connections = new Map<string, ConversationEventConnection>();
	private readonly enabled: boolean;
	private readonly sourceId = crypto.randomUUID();

	constructor(
		private readonly env: CloudflareBindings,
		private readonly onRemoteEvent: (envelope: PublishEnvelope) => Promise<void> | void,
		private readonly getExecutionCtx: () => ExecutionContextLike | undefined
	) {
		this.enabled = Boolean(this.env.CONVERSATION_EVENTS && this.env.CONVERSATION_EVENTS_SECRET);
	}

	async publish<TName extends ConversationEventName>(
		type: TName,
		payload: PubSubPayloads[TName][0]
	) {
		if (!this.enabled) return;
		const publishPromise = this.publishViaDurableObject({
			type,
			conversationId: payload.conversationId,
			payload,
			sourceId: this.sourceId,
		});
		const executionCtx = this.getExecutionCtx();
		if (executionCtx) {
			executionCtx.waitUntil(publishPromise);
		}
		await publishPromise;
	}

	addSubscriber(conversationId: string) {
		if (!this.enabled) return;
		const connection = this.getConnection(conversationId);
		connection.addSubscriber();
	}

	removeSubscriber(conversationId: string) {
		if (!this.enabled) return;
		const connection = this.connections.get(conversationId);
		connection?.removeSubscriber();
		if (connection?.isIdle()) {
			this.connections.delete(conversationId);
		}
	}

	private getConnection(conversationId: string) {
		let connection = this.connections.get(conversationId);
		if (!connection) {
			connection = new ConversationEventConnection(
				conversationId,
				this.env,
				this.onRemoteEvent,
				this.getExecutionCtx
			);
			this.connections.set(conversationId, connection);
		}
		return connection;
	}

	private async publishViaDurableObject(envelope: PublishEnvelope) {
		const id = this.env.CONVERSATION_EVENTS.idFromName(envelope.conversationId);
		const stub = this.env.CONVERSATION_EVENTS.get(id);
		const response = await stub.fetch(`https://conversation-events/${envelope.conversationId}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Conversation-Events-Secret": this.env.CONVERSATION_EVENTS_SECRET,
			},
			body: JSON.stringify({
				type: "publish",
				event: envelope,
			}),
		});

		if (!response.ok) {
			throw new Error(`Failed to publish conversation event: ${response.status}`);
		}
	}
}

class ConversationPubSub {
	private readonly eventTarget = new EventTarget();
	private readonly localPubSub = createLocalPubSub(this.eventTarget);
	private readonly hub: ConversationEventHub;
	private executionCtx?: ExecutionContextLike;
	private readonly enabled: boolean;

	constructor(private readonly env: CloudflareBindings) {
		this.enabled = Boolean(env.CONVERSATION_EVENTS && env.CONVERSATION_EVENTS_SECRET);
		this.hub = new ConversationEventHub(
			env,
			(envelope) => this.dispatchLocal(envelope.type, envelope.payload),
			() => this.executionCtx
		);
	}

	setExecutionContext(executionCtx?: ExecutionContextLike) {
		this.executionCtx = executionCtx;
	}

	async publish<TName extends ConversationEventName>(
		type: TName,
		payload: PubSubPayloads[TName][0]
	) {
		if (!this.enabled) {
			console.error("Conversation events not configured; dropping publish");
			return;
		}
		await this.hub.publish(type, payload);
	}

	subscribe<TName extends ConversationEventName>(type: TName) {
		if (!this.enabled) {
			throw new Error("Conversation events not configured; subscriptions disabled");
		}
		return this.localPubSub.subscribe(type);
	}

	trackConversations(conversationIds: string[]) {
		if (!this.enabled) {
			throw new Error("Conversation events not configured; subscriptions disabled");
		}
		const unique = Array.from(new Set(conversationIds)).filter(Boolean);
		unique.forEach((id) => this.hub.addSubscriber(id));
		return () => {
			unique.forEach((id) => this.hub.removeSubscriber(id));
		};
	}

	subscribeToConversation<TName extends ConversationEventName>(
		type: TName,
		conversationId: string
	): AsyncIterable<PubSubPayloads[TName][0]> {
		if (!this.enabled) {
			throw new Error("Conversation events not configured; subscriptions disabled");
		}
		this.hub.addSubscriber(conversationId);
		const iterator = this.localPubSub.subscribe(type);
		const filtered = filterAsyncIterator(
			iterator,
			(payload) => payload.conversationId === conversationId
		);
		return withCleanup(filtered, () => this.hub.removeSubscriber(conversationId));
	}

	private dispatchLocal<TName extends ConversationEventName>(
		type: TName,
		payload: PubSubPayloads[TName][0]
	) {
		const event = new CustomEvent(type, { detail: payload });
		this.eventTarget.dispatchEvent(event);
	}
}

async function* filterAsyncIterator<T>(
	source: AsyncIterable<T>,
	predicate: (value: T) => boolean
): AsyncGenerator<T, void, unknown> {
	for await (const value of source) {
		if (predicate(value)) yield value;
	}
}

async function* withCleanup<T>(
	source: AsyncIterable<T>,
	onFinally: () => void
): AsyncGenerator<T, void, unknown> {
	try {
		for await (const value of source) {
			yield value;
		}
	} finally {
		onFinally();
	}
}

let cachedPubSub: ConversationPubSub | null = null;

export function getConversationPubSub(
	env: CloudflareBindings,
	executionCtx?: ExecutionContextLike
) {
	if (!cachedPubSub) {
		cachedPubSub = new ConversationPubSub(env);
	}
	cachedPubSub.setExecutionContext(executionCtx);
	return cachedPubSub;
}

export type ConversationPubSubType = ReturnType<typeof getConversationPubSub>;

function safeParse(raw: string): unknown | null {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function parseEventEnvelope(raw: string): PublishEnvelope | null {
	const parsed = safeParse(raw);
	if (!isRecord(parsed)) return null;
	if (parsed.type !== "event" || !("event" in parsed)) return null;
	const event = parsed.event;
	if (!isRecord(event)) return null;
	if (typeof event.conversationId !== "string" || typeof event.type !== "string") return null;
	if (
		event.type !== "messageAdded" &&
		event.type !== "deliveryUpdated" &&
		event.type !== "conversationUpdated"
	) {
		return null;
	}
	if ("messageId" in event && typeof event.messageId !== "string") return null;
	if ("seq" in event && typeof event.seq !== "number") return null;
	if ("sourceId" in event && typeof event.sourceId !== "string") return null;
	if (!("payload" in event) || !isPayloadValid(event.type, event.payload)) return null;

	return {
		conversationId: event.conversationId,
		type: event.type,
		seq: typeof event.seq === "number" ? event.seq : undefined,
		sourceId: typeof event.sourceId === "string" ? event.sourceId : undefined,
		payload: event.payload,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isPayloadValid(
	type: ConversationEventName,
	payload: unknown
): payload is PubSubPayloads[ConversationEventName][0] {
	if (!isRecord(payload)) return false;
	if (typeof payload.conversationId !== "string") return false;
	if (type === "conversationUpdated") return true;
	return typeof (payload as { messageId?: unknown }).messageId === "string";
}

type ExecutionContextLike = Pick<ExecutionContext, "waitUntil" | "passThroughOnException">;

type LocalPubSub = {
	publish(type: ConversationEventName, payload: PubSubPayload): void;
	subscribe(type: ConversationEventName): AsyncIterable<PubSubPayload>;
};

function createLocalPubSub(eventTarget: EventTarget): LocalPubSub {
	const base = createPubSub<PubSubPayloads>({ eventTarget });

	return {
		publish: (type, payload) => base.publish(type, payload),
		subscribe: (type) =>
			(async function* () {
				for await (const value of base.subscribe(type)) {
					if (isPubSubPayload(value)) {
						yield value;
					}
				}
			})(),
	};
}

function isPubSubPayload(value: unknown): value is PubSubPayload {
	return isRecord(value) && typeof value.conversationId === "string";
}
