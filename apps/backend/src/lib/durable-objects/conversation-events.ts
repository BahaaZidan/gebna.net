import { DurableObject } from "cloudflare:workers";

import type { ConversationEventEnvelope } from "$lib/graphql/pubsub";

type IncomingMessage = { type: "publish"; event: ConversationEventEnvelope };
type BroadcastMessage = { type: "event"; event: ConversationEventEnvelope };

export class ConversationEventsDurableObject extends DurableObject<CloudflareBindings> {
	private readonly connections = new Map<string, WebSocket>();
	private seq = 0;
	private seqLoaded = false;
	private conversationId: string | null = null;

	async fetch(request: Request) {
		const url = new URL(request.url);
		this.conversationId =
			this.conversationId ?? this.ctx.id.name ?? (url.pathname.replace(/^\//, "") || null);

		if (request.headers.get("x-conversation-events-secret") !== this.env.CONVERSATION_EVENTS_SECRET) {
			return new Response("Unauthorized", { status: 403 });
		}

		if (request.method === "POST") {
			return this.handleHttpPublish(request);
		}

		if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
			return new Response("Not Found", { status: 404 });
		}

		const pair = new WebSocketPair();
		const [client, server] = [pair[0], pair[1]];

		server.accept();
		const connectionId = crypto.randomUUID();
		this.connections.set(connectionId, server);

		server.addEventListener("close", () => this.connections.delete(connectionId));
		server.addEventListener("error", () => this.connections.delete(connectionId));

		return new Response(null, { status: 101, webSocket: client });
	}

	private async handleHttpPublish(request: Request) {
		const bodyText = await request.text();
		const parsed = parsePublishMessage(bodyText);
		if (!parsed || !parsed.event?.conversationId) {
			return new Response("Bad Request", { status: 400 });
		}
		if (!this.conversationId) {
			this.conversationId = parsed.event.conversationId;
		} else if (parsed.event.conversationId !== this.conversationId) {
			return new Response("Bad Request", { status: 400 });
		}

		const seq = await this.nextSeq();
		const broadcast: BroadcastMessage = {
			type: "event",
			event: { ...parsed.event, seq },
		};

		this.broadcast(broadcast);
		return new Response(null, { status: 204 });
	}

	private async nextSeq() {
		if (!this.seqLoaded) {
			const storedSeq = await this.ctx.storage.get<number>("seq");
			this.seq = typeof storedSeq === "number" ? storedSeq : 0;
			this.seqLoaded = true;
		}
		this.seq += 1;
		await this.ctx.storage.put("seq", this.seq);
		return this.seq;
	}

	private broadcast(message: BroadcastMessage) {
		const serialized = JSON.stringify(message);
		for (const [id, socket] of this.connections.entries()) {
			try {
				socket.send(serialized);
			} catch {
				socket.close();
				this.connections.delete(id);
			}
		}
	}
}

function safeParse(raw: string): unknown | null {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function parsePublishMessage(raw: string): IncomingMessage | null {
	const parsed = safeParse(raw);
	if (!isRecord(parsed)) return null;
	if (parsed.type !== "publish" || !("event" in parsed)) return null;
	if (!isConversationEventEnvelope(parsed.event)) return null;
	return { type: "publish", event: parsed.event };
}

function isConversationEventEnvelope(value: unknown): value is ConversationEventEnvelope {
	if (!isRecord(value)) return false;
	if (typeof value.conversationId !== "string") return false;
	if (typeof value.type !== "string") return false;
	if (!isRecord(value.payload)) return false;
	if ("seq" in value && value.seq !== null && typeof value.seq !== "number") return false;
	if ("sourceId" in value && typeof value.sourceId !== "string") return false;
	if ("messageId" in value && typeof value.messageId !== "string") return false;
	return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
