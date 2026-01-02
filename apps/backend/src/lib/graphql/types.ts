type YogaExecutionContext = Pick<ExecutionContext, "waitUntil" | "passThroughOnException">;

export type YogaServerContext = {
	env: CloudflareBindings;
	executionCtx: YogaExecutionContext;
};
