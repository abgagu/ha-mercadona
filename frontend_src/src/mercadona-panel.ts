import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import type {
	BulkAddResponse,
	CartLine,
	HomeAssistant,
	PanelInfo,
	PendingItem,
	PendingResolution,
	Route,
	TodoItem,
} from "./types.js";

const MIN_ORDER = 60;
const PANEL_VERSION = "0.1.0";
const PANEL_TAG = "mercadona-panel";
const STORAGE_KEY_ALEXA_ENT = "mercadona-panel.alexa_entity";

export class MercadonaPanel extends LitElement {
	// Props inyectadas por HA al panel.
	@property({ attribute: false }) hass?: HomeAssistant;
	@property({ type: Boolean }) narrow = false;
	@property({ attribute: false }) route?: Route;
	@property({ attribute: false }) panel?: PanelInfo;

	@state() private _busy = false;
	@state() private _error?: string;
	@state() private _alexaItems: TodoItem[] = [];
	@state() private _alexaLoaded = false;
	@state() private _alexaLoadedFor?: string;
	@state() private _alexaLoadError?: string;
	@state() private _pending: PendingItem[] = [];
	@state() private _alexaOverride?: string =
		(typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY_ALEXA_ENT)) || undefined;

	connectedCallback(): void {
		super.connectedCallback();
		// Carga inicial diferida hasta tener hass.
		queueMicrotask(() => this._loadAlexaListIfNeeded());
	}

	updated(): void {
		this._loadAlexaListIfNeeded();
	}

	// ---------- Deteccion de entidades --------------------------------------

	private get _cartEntityId(): string | undefined {
		const cfg = (this.panel?.config ?? {}) as { cart_entity?: string };
		if (cfg.cart_entity) return cfg.cart_entity;
		if (!this.hass) return undefined;
		for (const [id, ent] of Object.entries(this.hass.states)) {
			if (!id.startsWith("sensor.")) continue;
			const attrs = ent.attributes;
			if ("lines" in attrs && "cart_id" in attrs && "products_count" in attrs) {
				return id;
			}
		}
		return undefined;
	}

	private get _allTodoEntities(): string[] {
		if (!this.hass) return [];
		return Object.keys(this.hass.states).filter((id) => id.startsWith("todo.")).sort();
	}

	private get _alexaEntityId(): string | undefined {
		// 1) Override del usuario via selector (persistido en localStorage)
		if (this._alexaOverride && this.hass?.states[this._alexaOverride]) {
			return this._alexaOverride;
		}
		// 2) Override via config del panel (panel_custom config={"alexa_entity": "..."})
		const cfg = (this.panel?.config ?? {}) as { alexa_entity?: string };
		if (cfg.alexa_entity) return cfg.alexa_entity;
		// 3) Heuristica priorizada: lista de la compra > shopping > alexa generica
		const todos = this._allTodoEntities;
		if (todos.length === 0) return undefined;
		const tryMatch = (re: RegExp) => todos.find((id) => re.test(id));
		return (
			tryMatch(/shop(p?ing)?|compra/i) ??
			tryMatch(/alexa/i) ??
			todos[0]
		);
	}

	private _setAlexaOverride(entityId: string): void {
		this._alexaOverride = entityId || undefined;
		try {
			if (entityId) localStorage.setItem(STORAGE_KEY_ALEXA_ENT, entityId);
			else localStorage.removeItem(STORAGE_KEY_ALEXA_ENT);
		} catch {
			// localStorage no disponible en algun contexto raro
		}
		this._alexaItems = [];
		this._alexaLoaded = false;
		this._alexaLoadedFor = undefined;
		this._loadAlexaListIfNeeded();
	}

	// ---------- Datos del carrito -------------------------------------------

	private _getLines(): CartLine[] {
		const id = this._cartEntityId;
		if (!id || !this.hass) return [];
		const ent = this.hass.states[id];
		const lines = ent?.attributes["lines"] as CartLine[] | undefined;
		return Array.isArray(lines) ? lines : [];
	}

	private _getTotal(): number {
		const id = this._cartEntityId;
		if (!id || !this.hass) return 0;
		const ent = this.hass.states[id];
		const v = parseFloat(ent?.state ?? "0");
		return Number.isFinite(v) ? v : 0;
	}

	// ---------- Llamadas a HA -----------------------------------------------

	private async _callService(
		domain: string,
		service: string,
		data: Record<string, unknown>,
		returnResponse = false,
	): Promise<unknown> {
		if (!this.hass) return undefined;
		this._busy = true;
		this._error = undefined;
		try {
			const result = await this.hass.callService(
				domain, service, data, undefined, true, returnResponse,
			);
			return returnResponse ? (result.response ?? null) : null;
		} catch (err) {
			this._error = err instanceof Error ? err.message : String(err);
			throw err;
		} finally {
			this._busy = false;
		}
	}

	private async _loadAlexaListIfNeeded(): Promise<void> {
		if (!this.hass) return;
		const id = this._alexaEntityId;
		if (!id) return;
		// Si la entidad no esta disponible no hace falta intentarlo: el
		// servicio devolveria error y entraria en bucle al re-renderizar
		// tras cada cambio de estado. Saltamos hasta que vuelva.
		const entState = this.hass.states[id]?.state;
		if (entState === undefined || entState === "unavailable" || entState === "unknown") {
			return;
		}
		// Solo recargar si no se ha cargado nunca o si la entidad cambio.
		if (this._alexaLoaded && this._alexaLoadedFor === id) return;

		// Marcamos cargado ANTES del await para que cualquier re-render
		// concurrente vea la guarda y no dispare cargas paralelas. Sobre
		// error NO reseteamos: el usuario puede pulsar el boton refresh.
		this._alexaLoaded = true;
		this._alexaLoadedFor = id;
		this._alexaLoadError = undefined;

		try {
			// Llamada silenciosa: no toca _busy ni _error globales para no
			// causar re-renders en cadena ni mostrar el banner rojo por una
			// carga de fondo.
			const result = await this.hass.callService(
				"todo", "get_items",
				{ entity_id: id, status: ["needs_action"] },
				undefined, false, true,
			);
			const resp = result.response as Record<string, { items?: TodoItem[] }> | undefined;
			this._alexaItems = resp?.[id]?.items ?? [];
		} catch (err) {
			this._alexaLoadError = err instanceof Error ? err.message : String(err);
			this._alexaItems = [];
		}
	}

	private async _refreshAlexa(): Promise<void> {
		this._alexaLoaded = false;
		this._alexaLoadedFor = undefined;
		this._alexaLoadError = undefined;
		await this._loadAlexaListIfNeeded();
	}

	// ---------- Acciones del carrito ----------------------------------------

	private _incQty(line: CartLine): void {
		this._callService("mercadona", "set_quantity", {
			product_id: line.product_id,
			quantity: Math.round(line.quantity) + 1,
		});
	}

	private _decQty(line: CartLine): void {
		const next = Math.round(line.quantity) - 1;
		this._callService("mercadona", "set_quantity", {
			product_id: line.product_id,
			quantity: Math.max(next, 0),
		});
	}

	private _removeLine(line: CartLine): void {
		this._callService("mercadona", "remove_product", { product_id: line.product_id });
	}

	// ---------- Acciones del area de pendientes -----------------------------

	private async _moveToPending(item: TodoItem): Promise<void> {
		if (this._pending.some((p) => p.uid === item.uid)) return;
		const pending: PendingItem = {
			uid: item.uid,
			summary: item.summary,
			quantity: null,  // se rellena tras dry_run con recommended del producto
			resolution: null,
		};
		this._pending = [...this._pending, pending];
		await this._resolvePending(pending);
	}

	private async _moveAllToPending(): Promise<void> {
		const toMove = this._alexaItems.filter(
			(i) => !this._pending.some((p) => p.uid === i.uid),
		);
		if (toMove.length === 0) return;
		const newPending: PendingItem[] = toMove.map((i) => ({
			uid: i.uid,
			summary: i.summary,
			quantity: null,
			resolution: null,
		}));
		this._pending = [...this._pending, ...newPending];
		await this._resolveBulk(newPending);
	}

	private async _resolvePending(p: PendingItem): Promise<void> {
		await this._resolveBulk([p]);
	}

	private async _resolveBulk(items: PendingItem[]): Promise<void> {
		if (items.length === 0) return;
		try {
			const resp = (await this._callService(
				"mercadona", "bulk_add",
				{
					// Si quantity es null, NO la mandamos: el backend usara
					// recommended_quantity del producto resuelto.
					items: items.map((p) =>
						p.quantity != null
							? { name: p.summary, quantity: p.quantity }
							: { name: p.summary },
					),
					dry_run: true,
				},
				true,
			)) as BulkAddResponse | null;
			if (!resp) return;
			// Mapear respuesta a cada pending item por su `query`.
			const newPending = this._pending.map((p) => {
				if (!items.some((it) => it.uid === p.uid)) return p; // no afectado
				const matched = resp.added.find((a) => a.query === p.summary);
				if (matched) {
					const recommended = matched.recommended_quantity ?? matched.quantity ?? 1;
					return {
						...p,
						resolution: {
							kind: "matched",
							productId: matched.product_id,
							displayName: matched.matched,
							recommendedQty: recommended,
						} as PendingResolution,
						chosenProductId: matched.product_id,
						// El backend ya aplico recommended si quantity era null.
						quantity: matched.quantity,
					};
				}
				const amb = resp.ambiguous.find((a) => a.query === p.summary);
				if (amb) {
					const first = amb.candidates[0];
					return {
						...p,
						resolution: {
							kind: "ambiguous",
							candidates: amb.candidates,
						} as PendingResolution,
						chosenProductId: first?.product_id,
						// Pre-rellena con el recommended del primer candidato.
						quantity: first?.recommended_quantity ?? p.quantity ?? 1,
					};
				}
				if (resp.not_found.includes(p.summary)) {
					return { ...p, resolution: { kind: "not_found" } as PendingResolution };
				}
				return p;
			});
			this._pending = newPending;

			// Auto-commit de los items con un unico match: van directos al carrito
			// sin esperar confirmacion manual. Los ambiguos y not_found permanecen
			// en la columna para que el usuario decida.
			const autoCommit = newPending.filter(
				(p) =>
					items.some((it) => it.uid === p.uid) &&
					p.resolution?.kind === "matched",
			);
			if (autoCommit.length > 0) {
				await this._commitItems(autoCommit);
			}
		} catch {
			// _error ya fue seteado
		}
	}

	private _setPendingQty(uid: string, qty: number): void {
		this._pending = this._pending.map((p) =>
			p.uid === uid ? { ...p, quantity: Math.max(1, qty) } : p,
		);
	}

	private _setPendingChoice(uid: string, productId: string): void {
		this._pending = this._pending.map((p) => {
			if (p.uid !== uid) return p;
			// Al cambiar de candidato en ambigüedad, recalcula la cantidad
			// usando recommended del candidato elegido. Asi el usuario nunca
			// confirma una cantidad pensada para otro producto.
			if (p.resolution?.kind === "ambiguous") {
				const cand = p.resolution.candidates.find((c) => c.product_id === productId);
				return {
					...p,
					chosenProductId: productId,
					quantity: cand?.recommended_quantity ?? p.quantity ?? 1,
				};
			}
			return { ...p, chosenProductId: productId };
		});
	}

	private _removePending(uid: string): void {
		this._pending = this._pending.filter((p) => p.uid !== uid);
	}

	private async _commitItems(items: PendingItem[]): Promise<void> {
		const resolvable = items.filter(
			(p) => p.chosenProductId && p.resolution && p.resolution.kind !== "not_found",
		);
		if (resolvable.length === 0) return;
		try {
			await this._callService("mercadona", "bulk_add", {
				items: resolvable.map((p) =>
					// Si p.quantity es null aun (improbable: solo se llega aqui
					// con resolucion ya hecha), dejamos que el backend resuelva
					// con recommended omitiendo la clave.
					p.quantity != null
						? { product_id: p.chosenProductId, quantity: p.quantity }
						: { product_id: p.chosenProductId },
				),
				dry_run: false,
			});

			// Marcar los items de la lista todo como completados (best-effort).
			const alexaId = this._alexaEntityId;
			if (alexaId && this.hass) {
				await Promise.all(
					resolvable.map((p) =>
						this.hass!
							.callService(
								"todo", "update_item",
								{ item: p.uid, status: "completed" },
								{ entity_id: alexaId },
								false,
							)
							.catch((err) => {
								// No abortamos: el carrito ya tiene el producto.
								console.warn(`No pude marcar '${p.summary}' como completado:`, err);
							}),
					),
				);
				// Recargar lista para reflejar el cambio.
				await this._refreshAlexa();
			}

			// Limpiamos los que se anadieron.
			const okUids = new Set(resolvable.map((p) => p.uid));
			this._pending = this._pending.filter((p) => !okUids.has(p.uid));
		} catch {
			// _error ya fue seteado
		}
	}

	// ---------- Render ------------------------------------------------------

	render() {
		if (!this.hass) return nothing;
		const total = this._getTotal();
		const gap = Math.max(MIN_ORDER - total, 0);
		const cartEntId = this._cartEntityId;
		const cartEnt = cartEntId ? this.hass.states[cartEntId] : undefined;

		return html`
			<div class="panel">
				<header>
					<h1>Mercadona</h1>
					<div class="totals">
						<span class="total-amount">${total.toFixed(2)} €</span>
						<span class="total-status">
							${gap > 0
								? html`Faltan <strong>${gap.toFixed(2)} €</strong> para el minimo de ${MIN_ORDER} €`
								: html`Pedido minimo alcanzado`}
						</span>
					</div>
				</header>

				${this._error ? html`<div class="error">${this._error}</div>` : nothing}

				${!cartEnt
					? html`<div class="empty">
							No encuentro el sensor del carrito de Mercadona. Verifica que la integracion esta configurada.
						</div>`
					: html`
							<div class="grid ${this.narrow ? "narrow" : ""}">
								${this._renderAlexaCol()}
								${this._renderCartCol()}
							</div>
						`}
			</div>
		`;
	}

	private _renderAlexaCol() {
		const id = this._alexaEntityId;
		const allTodos = this._allTodoEntities;
		const items = this._alexaItems;
		const pendingByUid = new Map(this._pending.map((p) => [p.uid, p]));
		const readyCount = this._pending.filter(
			(p) => p.chosenProductId && p.resolution && p.resolution.kind !== "not_found",
		).length;
		const unresolvedCount = items.filter((i) => !pendingByUid.has(i.uid)).length;

		return html`
			<section class="col col-source">
				<div class="col-header">
					<h2>Lista pendiente</h2>
					<div class="col-actions">
						<button class="ghost" @click=${() => this._refreshAlexa()} ?disabled=${this._busy} title="Refrescar">↻</button>
						${unresolvedCount > 0
							? html`<button @click=${() => this._moveAllToPending()} ?disabled=${this._busy}>→ Resolver todos</button>`
							: nothing}
						${readyCount > 0
							? html`<button class="primary" @click=${() => this._commitItems(this._pending)} ?disabled=${this._busy}>
									✓ Anadir ${readyCount} al carrito
								</button>`
							: nothing}
					</div>
				</div>
				${allTodos.length > 1
					? html`
							<div class="selector-row">
								<label>Lista:</label>
								<select
									@change=${(e: Event) =>
										this._setAlexaOverride((e.target as HTMLSelectElement).value)}
									?disabled=${this._busy}
								>
									${allTodos.map(
										(t) => html`<option value="${t}" ?selected=${t === id}>${t}</option>`,
									)}
								</select>
							</div>
						`
					: nothing}
				${!id
					? html`<div class="placeholder">No encuentro ninguna entidad <code>todo.*</code>. Necesitas la integracion de listas de Alexa o equivalente.</div>`
					: this._alexaLoadError
						? html`<div class="placeholder">
								No se pudo cargar la lista <code>${id}</code>. Posiblemente este no disponible. Pulsa ↻ para reintentar.
								<div class="error-detail">${this._alexaLoadError}</div>
							</div>`
						: this.hass?.states[id]?.state === "unavailable"
							? html`<div class="placeholder">La lista <code>${id}</code> esta no disponible.</div>`
							: items.length === 0
								? html`<div class="placeholder">Lista vacia.</div>`
								: html`
										<div class="alexa-rows">
											${items.map((item) => this._renderAlexaRow(item, pendingByUid.get(item.uid)))}
										</div>
									`}
			</section>
		`;
	}

	private _renderAlexaRow(item: TodoItem, pending: PendingItem | undefined) {
		const stateClass = pending?.resolution?.kind ?? (pending ? "loading" : "idle");
		return html`
			<div class="alexa-row ${stateClass}">
				<div class="alexa-name">${item.summary}</div>
				<div class="alexa-resolution">${this._renderResolutionInline(pending)}</div>
				<div class="alexa-actions">${this._renderRowActions(item, pending)}</div>
			</div>
		`;
	}

	private _renderResolutionInline(p: PendingItem | undefined) {
		if (!p) return nothing;
		if (!p.resolution) return html`<span class="muted">resolviendo…</span>`;
		if (p.resolution.kind === "matched") {
			return html`<span class="matched">${p.resolution.displayName}</span>`;
		}
		if (p.resolution.kind === "not_found") {
			return html`<span class="not-found">no encontrado en habituales</span>`;
		}
		// ambiguous
		const candidates = p.resolution.candidates;
		return html`
			<select
				@change=${(e: Event) => this._setPendingChoice(p.uid, (e.target as HTMLSelectElement).value)}
				.value=${p.chosenProductId ?? ""}
				?disabled=${this._busy}
			>
				${candidates.map(
					(c) => html`<option value="${c.product_id}" ?selected=${c.product_id === p.chosenProductId}>${c.display_name}</option>`,
				)}
			</select>
		`;
	}

	private _renderRowActions(item: TodoItem, p: PendingItem | undefined) {
		// Sin resolver aun
		if (!p) {
			return html`
				<button class="row-btn" @click=${() => this._moveToPending(item)} ?disabled=${this._busy} title="Resolver">→</button>
			`;
		}
		// En resolucion
		if (!p.resolution) {
			return html`<button class="row-btn" disabled>⋯</button>`;
		}
		// No encontrado: solo descartar
		if (p.resolution.kind === "not_found") {
			return html`<button class="row-btn remove" @click=${() => this._removePending(p.uid)} title="Descartar">×</button>`;
		}
		// Matched/Ambiguous: qty + confirmar + descartar
		const q = p.quantity ?? 1;
		const qReady = p.quantity != null;
		return html`
			<div class="qty-mini">
				<button @click=${() => this._setPendingQty(p.uid, q - 1)} ?disabled=${this._busy || !qReady || q <= 1}>−</button>
				<span>${qReady ? q : "—"}</span>
				<button @click=${() => this._setPendingQty(p.uid, q + 1)} ?disabled=${this._busy || !qReady}>+</button>
			</div>
			<button class="row-btn primary" @click=${() => this._commitItems([p])} ?disabled=${this._busy || !p.chosenProductId} title="Anadir al carrito">✓</button>
			<button class="row-btn remove" @click=${() => this._removePending(p.uid)} title="Descartar">×</button>
		`;
	}

	private _renderCartCol() {
		const lines = this._getLines();
		return html`
			<section class="col col-cart">
				<div class="col-header">
					<h2>Carrito (${lines.length})</h2>
				</div>
				${lines.length === 0
					? html`<div class="placeholder">Carrito vacio</div>`
					: html`<div class="lines">${lines.map((l) => this._renderLine(l))}</div>`}
			</section>
		`;
	}

	private _renderLine(line: CartLine) {
		return html`
			<div class="line">
				${line.thumbnail
					? html`<img class="thumb" src="${line.thumbnail}" alt="" />`
					: html`<div class="thumb placeholder-thumb"></div>`}
				<div class="info">
					<div class="name">${line.display_name}</div>
					<div class="price">${line.unit_price.toFixed(2)} € / ud</div>
				</div>
				<div class="qty">
					<button @click=${() => this._decQty(line)} ?disabled=${this._busy} aria-label="Restar">−</button>
					<span class="qty-value">${this._formatQty(line.quantity)}</span>
					<button @click=${() => this._incQty(line)} ?disabled=${this._busy} aria-label="Sumar">+</button>
				</div>
				<div class="line-total">${line.line_total.toFixed(2)} €</div>
				<button class="remove" @click=${() => this._removeLine(line)} ?disabled=${this._busy} aria-label="Eliminar">×</button>
			</div>
		`;
	}

	private _formatQty(q: number): string {
		return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, "");
	}

	static styles = css`
		:host {
			display: block;
			min-height: 100vh;
			background: var(--primary-background-color);
			color: var(--primary-text-color);
		}
		.panel {
			max-width: 1400px;
			margin: 0 auto;
			padding: 24px;
		}
		header {
			display: flex;
			justify-content: space-between;
			align-items: flex-end;
			margin-bottom: 24px;
			padding-bottom: 12px;
			border-bottom: 1px solid var(--divider-color);
		}
		h1 {
			margin: 0;
			font-size: 1.8em;
			font-weight: 500;
		}
		.totals {
			text-align: right;
		}
		.total-amount {
			font-size: 1.8em;
			font-weight: 600;
			color: var(--primary-color);
			display: block;
		}
		.total-status {
			font-size: 0.9em;
			color: var(--secondary-text-color);
		}
		.error {
			background: var(--error-color, #b00020);
			color: white;
			padding: 12px;
			border-radius: 6px;
			margin-bottom: 16px;
		}
		.grid {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 24px;
		}
		.grid.narrow {
			grid-template-columns: 1fr;
		}
		.col {
			background: var(--card-background-color);
			border-radius: 8px;
			padding: 16px;
			box-shadow: var(--ha-card-box-shadow, 0 1px 3px rgba(0, 0, 0, 0.12));
		}
		.col-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 12px;
		}
		.col-header h2 {
			margin: 0;
			font-size: 1.1em;
			font-weight: 500;
			color: var(--secondary-text-color);
		}
		.col-actions {
			display: flex;
			gap: 6px;
		}
		button {
			border: 1px solid var(--divider-color);
			background: transparent;
			color: var(--primary-text-color);
			padding: 4px 10px;
			border-radius: 4px;
			cursor: pointer;
			font-size: 0.9em;
		}
		button:hover:not(:disabled) {
			background: var(--secondary-background-color);
		}
		button:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}
		button.ghost {
			border: none;
		}
		button.primary {
			background: var(--primary-color);
			color: white;
			border: none;
			padding: 8px 16px;
			font-weight: 500;
		}
		button.primary:hover:not(:disabled) {
			filter: brightness(1.1);
			background: var(--primary-color);
		}
		.placeholder {
			text-align: center;
			padding: 32px;
			color: var(--secondary-text-color);
			font-style: italic;
		}
		.error-detail {
			font-size: 0.8em;
			margin-top: 8px;
			color: var(--error-color, #b00020);
			font-family: monospace;
			word-break: break-word;
		}
		.empty {
			text-align: center;
			padding: 64px 16px;
			color: var(--secondary-text-color);
		}
		code {
			background: var(--secondary-background-color);
			padding: 2px 6px;
			border-radius: 3px;
			font-family: monospace;
		}

		/* Selector de lista */
		.selector-row {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 12px;
			font-size: 0.85em;
			color: var(--secondary-text-color);
		}
		.selector-row select {
			flex: 1;
		}

		/* Filas Alexa con resolucion inline */
		.alexa-rows {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}
		.alexa-row {
			display: grid;
			grid-template-columns: minmax(100px, max-content) 1fr auto;
			align-items: center;
			gap: 12px;
			padding: 8px 6px;
			border-bottom: 1px solid var(--divider-color);
			border-left: 3px solid transparent;
		}
		.alexa-row:last-child {
			border-bottom: none;
		}
		.alexa-row.matched {
			border-left-color: var(--success-color, #43a047);
		}
		.alexa-row.ambiguous {
			border-left-color: var(--warning-color, #ff9800);
		}
		.alexa-row.not_found {
			border-left-color: var(--error-color, #b00020);
			opacity: 0.7;
		}
		.alexa-row.loading {
			border-left-color: var(--secondary-text-color);
		}
		.alexa-name {
			font-weight: 500;
		}
		.alexa-resolution {
			min-width: 0;
			color: var(--secondary-text-color);
		}
		.alexa-resolution select {
			width: 100%;
		}
		.alexa-actions {
			display: flex;
			align-items: center;
			gap: 4px;
		}
		.row-btn {
			width: 32px;
			height: 32px;
			padding: 0;
			border-radius: 50%;
			border: 1px solid var(--divider-color);
			background: transparent;
			color: var(--primary-text-color);
			cursor: pointer;
			font-size: 1.1em;
			line-height: 1;
		}
		.row-btn:hover:not(:disabled) {
			background: var(--secondary-background-color);
		}
		.row-btn.primary {
			border-color: var(--primary-color);
			color: var(--primary-color);
		}
		.row-btn.primary:hover:not(:disabled) {
			background: var(--primary-color);
			color: white;
		}
		.row-btn.remove {
			border-color: transparent;
			color: var(--secondary-text-color);
		}
		.row-btn.remove:hover:not(:disabled) {
			background: var(--error-color, #b00020);
			color: white;
		}
		.qty-mini {
			display: flex;
			align-items: center;
			gap: 2px;
			margin-right: 4px;
		}
		.qty-mini button {
			width: 24px;
			height: 24px;
			padding: 0;
			border-radius: 50%;
			border: 1px solid var(--divider-color);
			background: transparent;
			color: var(--primary-text-color);
			cursor: pointer;
			line-height: 1;
		}
		.qty-mini button:hover:not(:disabled) {
			background: var(--secondary-background-color);
		}
		.qty-mini button:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}
		.qty-mini span {
			min-width: 20px;
			text-align: center;
			font-weight: 500;
		}
		.matched {
			color: var(--success-color, #43a047);
		}
		.not-found {
			color: var(--error-color, #b00020);
			font-style: italic;
		}
		.muted {
			color: var(--secondary-text-color);
			font-style: italic;
		}

		/* Lineas del carrito */
		.lines {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}
		.line {
			display: grid;
			grid-template-columns: 48px 1fr auto auto auto;
			align-items: center;
			gap: 12px;
			padding: 8px 0;
			border-bottom: 1px solid var(--divider-color);
		}
		.line:last-child {
			border-bottom: none;
		}
		.thumb {
			width: 48px;
			height: 48px;
			border-radius: 4px;
			object-fit: cover;
			background: var(--secondary-background-color);
		}
		.thumb.placeholder-thumb {
			border: 1px dashed var(--divider-color);
		}
		.info {
			min-width: 0;
		}
		.name {
			font-weight: 500;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.price {
			font-size: 0.85em;
			color: var(--secondary-text-color);
		}
		.qty {
			display: flex;
			align-items: center;
			gap: 4px;
		}
		.qty button {
			width: 28px;
			height: 28px;
			padding: 0;
			border-radius: 50%;
			font-size: 1.1em;
			line-height: 1;
		}
		.qty-value {
			min-width: 24px;
			text-align: center;
			font-weight: 500;
		}
		.line-total {
			font-weight: 500;
			min-width: 70px;
			text-align: right;
		}
		.remove {
			width: 28px;
			height: 28px;
			padding: 0;
			border: none;
			background: transparent;
			color: var(--secondary-text-color);
			font-size: 1.2em;
			border-radius: 50%;
		}
		.remove:hover:not(:disabled) {
			background: var(--error-color, #b00020);
			color: white;
		}

		select {
			padding: 4px 8px;
			border: 1px solid var(--divider-color);
			border-radius: 4px;
			background: var(--card-background-color);
			color: var(--primary-text-color);
			font-size: 0.95em;
			max-width: 100%;
		}
	`;
}

declare global {
	interface HTMLElementTagNameMap {
		"mercadona-panel": MercadonaPanel;
	}
}

// Registro idempotente: si el modulo se carga dos veces (recargas internas
// de HA, hot reload, etc.), no fallamos con "already defined".
if (!customElements.get(PANEL_TAG)) {
	customElements.define(PANEL_TAG, MercadonaPanel);
}

console.info(
	`%c MERCADONA-PANEL %c v${PANEL_VERSION} `,
	"color: white; background: #169B62; font-weight: 700;",
	"color: #169B62; background: white; font-weight: 700;",
);
