// Tipos minimos del objeto `hass` que HA inyecta en los paneles.

export interface HassEntity {
	entity_id: string;
	state: string;
	attributes: Record<string, unknown>;
}

export interface HomeAssistant {
	states: Record<string, HassEntity>;
	callService: (
		domain: string,
		service: string,
		serviceData?: Record<string, unknown>,
		target?: Record<string, unknown>,
		notifyOnError?: boolean,
		returnResponse?: boolean,
	) => Promise<{ response?: unknown }>;
	connection: unknown;
	language: string;
	themes?: { darkMode?: boolean };
}

export interface PanelInfo {
	component_name: string;
	config: Record<string, unknown>;
	icon: string | null;
	title: string | null;
	url_path: string;
}

export interface Route {
	prefix: string;
	path: string;
}

export interface CartLine {
	product_id: string;
	display_name: string;
	quantity: number;
	unit_price: number;
	line_total: number;
	thumbnail: string | null;
}

// Item de una lista todo.* nativa de HA.
export interface TodoItem {
	uid: string;
	summary: string;
	status: "needs_action" | "completed";
	description?: string | null;
	due?: string | null;
}

// Item en el area de pendientes (movido desde la lista hacia "a resolver").
export interface PendingItem {
	uid: string;                  // uid original del todo item
	summary: string;              // texto original
	quantity: number | null;      // null = aun no resuelta, usar recommended del producto
	resolution: PendingResolution | null;
	chosenProductId?: string;     // si el user elige uno de los candidatos
}

export interface AmbiguousCandidate {
	product_id: string;
	display_name: string;
	recommended_quantity?: number;
}

export type PendingResolution =
	| { kind: "matched"; productId: string; displayName: string; recommendedQty: number }
	| { kind: "ambiguous"; candidates: AmbiguousCandidate[] }
	| { kind: "not_found" };

// Respuesta del servicio mercadona.bulk_add.
export interface BulkAddResponse {
	added: {
		query: string;
		matched: string;
		product_id: string;
		quantity: number;
		recommended_quantity?: number;
	}[];
	not_found: string[];
	ambiguous: {
		query: string;
		candidates: AmbiguousCandidate[];
	}[];
	dry_run: boolean;
}
