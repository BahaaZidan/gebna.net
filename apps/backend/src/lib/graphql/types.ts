type YogaExecutionContext = Pick<ExecutionContext, "waitUntil" | "passThroughOnException">;

export type YogaServerContext = {
	env: CloudflareBindings;
	executionCtx: YogaExecutionContext;
	db?: unknown;
	viewer?: unknown;
	pubsub?: unknown;
};
