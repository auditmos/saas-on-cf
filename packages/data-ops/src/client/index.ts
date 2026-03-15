export {
	createClient,
	deleteClient,
	getClient,
	getClients,
	updateClient,
} from "./queries";
export type {
	Client,
	ClientCreateInput,
	ClientListResponse,
	ClientUpdateInput,
	ErrorResponse,
	PaginationMeta,
	PaginationRequest,
} from "./schema";
export {
	ClientCreateRequestSchema,
	ClientListResponseSchema,
	ClientSchema,
	ClientUpdateRequestSchema,
	ErrorResponseSchema,
	IdParamSchema,
	PaginationMetaSchema,
	PaginationRequestSchema,
} from "./schema";
export { clients } from "./table";
