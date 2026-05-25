interface ExampleWorkflowParams {
	dataToPassIn: Record<string, unknown>;
}

interface ExampleQueueMessage {
	messageData: Record<string, unknown>;
}

interface Env extends BaseEnv {}
