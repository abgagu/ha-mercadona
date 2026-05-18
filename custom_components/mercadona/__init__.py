"""Integracion Mercadona para Home Assistant."""
from __future__ import annotations

import logging
import os
from typing import Any

import voluptuous as vol

from homeassistant.components.http import StaticPathConfig
from homeassistant.components.panel_custom import async_register_panel
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_PASSWORD, CONF_USERNAME
from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .client import MercadonaClient, MercadonaError
from .const import (
	DATA_CLIENT,
	DATA_COORDINATOR,
	DOMAIN,
	PLATFORMS,
	SERVICE_ADD_PRODUCT,
	SERVICE_BULK_ADD,
	SERVICE_CLEAR_CART,
	SERVICE_REFRESH_REGULARS,
	SERVICE_REMOVE_PRODUCT,
	SERVICE_SET_QUANTITY,
)
from .coordinator import MercadonaCoordinator
from .matcher import find_best_matches

_LOGGER = logging.getLogger(__name__)


SCHEMA_NAME_QTY = vol.Schema(vol.All(
	{
		vol.Optional("name"): cv.string,
		vol.Optional("product_id"): cv.string,
		# Si se omite, se aplica recommended_quantity del producto en habituales.
		vol.Optional("quantity"): vol.All(int, vol.Range(min=1, max=50)),
	},
	cv.has_at_least_one_key("name", "product_id"),
))

SCHEMA_NAME = vol.Schema(vol.All(
	{
		vol.Optional("name"): cv.string,
		vol.Optional("product_id"): cv.string,
	},
	cv.has_at_least_one_key("name", "product_id"),
))

SCHEMA_SET_QTY = vol.Schema(vol.All(
	{
		vol.Optional("name"): cv.string,
		vol.Optional("product_id"): cv.string,
		vol.Required("quantity"): vol.All(int, vol.Range(min=0, max=50)),
	},
	cv.has_at_least_one_key("name", "product_id"),
))

_BULK_ITEM_OBJ = vol.All(
	vol.Schema({
		vol.Optional("name"): cv.string,
		vol.Optional("product_id"): cv.string,
		# Si se omite, se aplica recommended_quantity del producto en habituales.
		vol.Optional("quantity"): vol.All(int, vol.Range(min=1, max=50)),
	}),
	cv.has_at_least_one_key("name", "product_id"),
)

SCHEMA_BULK = vol.Schema({
	vol.Required("items"): vol.All(
		cv.ensure_list,
		[vol.Any(cv.string, _BULK_ITEM_OBJ)],
	),
	vol.Optional("dry_run", default=False): cv.boolean,
})


PANEL_URL_PATH = "mercadona"
PANEL_WEBCOMPONENT = "mercadona-panel"
PANEL_STATIC_URL = f"/api/{DOMAIN}_panel/mercadona-panel.js"
PANEL_MODULE_URL = f"{PANEL_STATIC_URL}?v=0.1.0"
# Namespace SEPARADO para flags internas del panel; hass.data[DOMAIN] solo
# guarda dicts {DATA_CLIENT, DATA_COORDINATOR} indexados por entry_id.
PANEL_DATA_KEY = f"{DOMAIN}_panel"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
	hass.data.setdefault(DOMAIN, {})
	await _async_register_panel(hass)
	return True


async def _async_register_panel(hass: HomeAssistant) -> None:
	"""Sirve el JS del panel y registra la entrada en el sidebar."""
	panel_data = hass.data.setdefault(PANEL_DATA_KEY, {})
	if panel_data.get("registered"):
		return

	frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
	if not os.path.isdir(frontend_dir):
		_LOGGER.warning("No se encontro %s; no se registra el panel", frontend_dir)
		return

	await hass.http.async_register_static_paths([
		StaticPathConfig(PANEL_STATIC_URL.rsplit("/", 1)[0], frontend_dir, cache_headers=False),
	])

	try:
		await async_register_panel(
			hass,
			webcomponent_name=PANEL_WEBCOMPONENT,
			frontend_url_path=PANEL_URL_PATH,
			module_url=PANEL_MODULE_URL,
			sidebar_title="Mercadona",
			sidebar_icon="mdi:cart",
			require_admin=False,
			config={},
			embed_iframe=False,
		)
		panel_data["registered"] = True
		_LOGGER.info("Panel Mercadona registrado en /%s", PANEL_URL_PATH)
	except ValueError:
		# Ya estaba registrado (p.ej. tras reload).
		panel_data["registered"] = True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
	session = async_get_clientsession(hass)
	client = MercadonaClient(
		session,
		username=entry.data[CONF_USERNAME],
		password=entry.data[CONF_PASSWORD],
	)
	try:
		await client.login()
	except MercadonaError as err:
		_LOGGER.error("No se pudo iniciar sesion en Mercadona: %s", err)
		raise

	coordinator = MercadonaCoordinator(hass, client)
	await coordinator.async_config_entry_first_refresh()

	hass.data[DOMAIN][entry.entry_id] = {
		DATA_CLIENT: client,
		DATA_COORDINATOR: coordinator,
	}

	await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
	_register_services(hass)
	return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
	unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
	if unloaded:
		hass.data[DOMAIN].pop(entry.entry_id, None)
	if not hass.data[DOMAIN]:
		for svc in (
			SERVICE_ADD_PRODUCT, SERVICE_BULK_ADD, SERVICE_REMOVE_PRODUCT,
			SERVICE_CLEAR_CART, SERVICE_SET_QUANTITY, SERVICE_REFRESH_REGULARS,
		):
			hass.services.async_remove(DOMAIN, svc)
	return unloaded


# --- Servicios ------------------------------------------------------------


def _get_single_entry_data(hass: HomeAssistant) -> dict[str, Any]:
	"""Devuelve los datos del unico config entry. Si hay varios, devuelve el primero.

	Para multi-cuenta habria que extender los servicios con un selector de cuenta.
	Filtra defensivamente cualquier valor que no sea dict (proteccion ante claves
	contaminadas en hass.data[DOMAIN]).
	"""
	bucket = hass.data.get(DOMAIN) or {}
	entries = [v for v in bucket.values() if isinstance(v, dict)]
	if not entries:
		raise HomeAssistantError("Mercadona no esta configurado")
	return entries[0]


def _lookup_item_in_universe(coordinator: MercadonaCoordinator, product_id: str) -> dict | None:
	"""Devuelve el ITEM ENTERO del universo de busqueda (habituales + listas personalizadas)."""
	for item in coordinator.search_universe:
		if item.get("product", {}).get("id") == product_id:
			return item
	return None


def _recommended_qty(item: dict | None) -> int:
	"""Cantidad recomendada para un item del universo. Fallback 1.

	Para items de Mis Habituales viene del API; para items de listas
	personalizadas se asume 1 (la API de listas no expone cantidad recomendada).
	"""
	if not item:
		return 1
	rq = item.get("recommended_quantity")
	try:
		rqf = float(rq)
		if rqf >= 1:
			return int(rqf)
	except (TypeError, ValueError):
		pass
	return 1


def _effective_qty(quantity: int | None, item: dict | None) -> int:
	"""Resuelve la cantidad a usar: explicita si el caller la dio, si no recommended."""
	if quantity is not None:
		return int(quantity)
	return _recommended_qty(item)


def _resolve_by_call(
	coordinator: MercadonaCoordinator, call_data: dict, source: str = "tus listas"
) -> tuple[str, str, dict | None]:
	"""Resuelve (product_id, display_name, item_del_universo) desde un ServiceCall.

	Si la llamada incluye `product_id`, se devuelve directo sin pasar por el matcher
	(elimina la re-ambiguedad en flujos de desambiguacion). Si solo viene `name`,
	corre el matcher contra el universo (habituales + listas personalizadas).

	El tercer valor puede ser None si el product_id pasado no esta en el universo —
	en ese caso no hay recommended_quantity disponible.
	"""
	product_id = call_data.get("product_id")
	if product_id:
		item = _lookup_item_in_universe(coordinator, product_id)
		display_name = item["product"]["display_name"] if item else f"Producto {product_id}"
		return product_id, display_name, item

	name = call_data["name"]
	matches = find_best_matches(name, coordinator.search_universe)
	if not matches:
		raise HomeAssistantError(f"No encuentro '{name}' en {source}")
	if len(matches) > 1:
		names = ", ".join(m.item["product"]["display_name"] for m in matches)
		raise HomeAssistantError(f"'{name}' es ambiguo: {names}")
	item = matches[0].item
	prod = item["product"]
	return prod["id"], prod["display_name"], item


def _register_services(hass: HomeAssistant) -> None:
	if hass.services.has_service(DOMAIN, SERVICE_ADD_PRODUCT):
		return

	async def handle_add(call: ServiceCall) -> ServiceResponse:
		data = _get_single_entry_data(hass)
		coordinator: MercadonaCoordinator = data[DATA_COORDINATOR]
		client: MercadonaClient = data[DATA_CLIENT]
		product_id, display_name, item = _resolve_by_call(coordinator, call.data)
		qty = _effective_qty(call.data.get("quantity"), item)
		try:
			await client.add_to_cart(product_id, qty)
		except MercadonaError as err:
			raise HomeAssistantError(f"Mercadona: {err}") from err
		await coordinator.async_request_refresh()
		return {
			"added": display_name,
			"product_id": product_id,
			"quantity": qty,
			"recommended_quantity": _recommended_qty(item),
		}

	async def handle_bulk(call: ServiceCall) -> ServiceResponse:
		try:
			return await _handle_bulk_impl(hass, call)
		except HomeAssistantError:
			raise
		except Exception as err:
			_LOGGER.exception(
				"Excepcion no controlada en mercadona.bulk_add. data=%r",
				dict(call.data),
			)
			raise HomeAssistantError(
				f"Mercadona bulk_add fallo: {type(err).__name__}: {err}"
			) from err

	async def _handle_bulk_impl(hass: HomeAssistant, call: ServiceCall) -> ServiceResponse:
		data = _get_single_entry_data(hass)
		coordinator: MercadonaCoordinator = data[DATA_COORDINATOR]
		client: MercadonaClient = data[DATA_CLIENT]
		raw_items = call.data["items"]
		universe = coordinator.search_universe
		_LOGGER.debug(
			"bulk_add invocado con items=%r dry_run=%r universe=%d (regulars=%d, listas=%d)",
			raw_items, call.data.get("dry_run"), len(universe),
			len(coordinator.regulars), len(coordinator.shopping_lists),
		)

		resolved: list[tuple[str, int]] = []
		added: list[dict] = []
		not_found: list[str] = []
		ambiguous: list[dict] = []

		for raw in raw_items:
			if isinstance(raw, str):
				name, product_id, qty_in = raw, None, None
			else:
				name = raw.get("name")
				product_id = raw.get("product_id")
				qty_in = raw.get("quantity")  # puede ser None → se usa recommended

			# Vía rápida: si el caller resolvió previamente la ambigüedad y pasa product_id,
			# no se vuelve a correr el matcher (eso era lo que reintroducía la ambigüedad).
			if product_id:
				item = _lookup_item_in_universe(coordinator, product_id)
				display_name = item["product"]["display_name"] if item else f"Producto {product_id}"
				qty = _effective_qty(qty_in, item)
				resolved.append((product_id, qty))
				added.append({
					"query": name or product_id,
					"matched": display_name,
					"product_id": product_id,
					"quantity": qty,
					"recommended_quantity": _recommended_qty(item),
				})
				continue

			matches = find_best_matches(name, universe)
			if not matches:
				not_found.append(name)
				continue
			if len(matches) > 1:
				ambiguous.append({
					"query": name,
					"candidates": [
						{
							"display_name": m.item["product"]["display_name"],
							"product_id": m.item["product"]["id"],
							"recommended_quantity": _recommended_qty(m.item),
						}
						for m in matches
					],
				})
				continue
			item = matches[0].item
			prod = item["product"]
			qty = _effective_qty(qty_in, item)
			resolved.append((prod["id"], qty))
			added.append({
				"query": name,
				"matched": prod["display_name"],
				"product_id": prod["id"],
				"quantity": qty,
				"recommended_quantity": _recommended_qty(item),
			})

		dry_run = bool(call.data.get("dry_run", False))
		if resolved and not dry_run:
			try:
				await client.add_multiple_to_cart(resolved)
			except MercadonaError as err:
				raise HomeAssistantError(f"Mercadona: {err}") from err
			await coordinator.async_request_refresh()

		return {
			"added": added,
			"not_found": not_found,
			"ambiguous": ambiguous,
			"dry_run": dry_run,
		}

	async def handle_remove(call: ServiceCall) -> ServiceResponse:
		data = _get_single_entry_data(hass)
		coordinator: MercadonaCoordinator = data[DATA_COORDINATOR]
		client: MercadonaClient = data[DATA_CLIENT]
		cart = (coordinator.data or {}).get("cart") or {}

		# Vía directa por product_id: salta el matcher.
		product_id = call.data.get("product_id")
		if product_id:
			line = next(
				(l for l in cart.get("lines", []) if l["product"]["id"] == product_id),
				None,
			)
			display_name = line["product"]["display_name"] if line else f"Producto {product_id}"
		else:
			# Búsqueda fuzzy contra las líneas del carrito (no contra habituales).
			cart_lines = [{"product": l["product"]} for l in cart.get("lines", [])]
			matches = find_best_matches(call.data["name"], cart_lines)
			if not matches:
				raise HomeAssistantError(f"No encuentro '{call.data['name']}' en el carrito")
			if len(matches) > 1:
				names = ", ".join(m.item["product"]["display_name"] for m in matches)
				raise HomeAssistantError(f"'{call.data['name']}' ambiguo en el carrito: {names}")
			prod = matches[0].item["product"]
			product_id, display_name = prod["id"], prod["display_name"]

		try:
			await client.remove_from_cart(product_id)
		except MercadonaError as err:
			raise HomeAssistantError(f"Mercadona: {err}") from err
		await coordinator.async_request_refresh()
		return {"removed": display_name, "product_id": product_id}

	async def handle_clear(call: ServiceCall) -> ServiceResponse:
		data = _get_single_entry_data(hass)
		client: MercadonaClient = data[DATA_CLIENT]
		coordinator: MercadonaCoordinator = data[DATA_COORDINATOR]
		try:
			await client.clear_cart()
		except MercadonaError as err:
			raise HomeAssistantError(f"Mercadona: {err}") from err
		await coordinator.async_request_refresh()
		return {"cleared": True}

	async def handle_set_qty(call: ServiceCall) -> ServiceResponse:
		data = _get_single_entry_data(hass)
		coordinator: MercadonaCoordinator = data[DATA_COORDINATOR]
		client: MercadonaClient = data[DATA_CLIENT]
		product_id, display_name, _item = _resolve_by_call(coordinator, call.data)
		try:
			await client.set_cart_line_quantity(product_id, int(call.data["quantity"]))
		except MercadonaError as err:
			raise HomeAssistantError(f"Mercadona: {err}") from err
		await coordinator.async_request_refresh()
		return {"product": display_name, "product_id": product_id, "quantity": call.data["quantity"]}

	async def handle_refresh_regulars(call: ServiceCall) -> ServiceResponse:
		data = _get_single_entry_data(hass)
		coordinator: MercadonaCoordinator = data[DATA_COORDINATOR]
		try:
			await coordinator.async_refresh_regulars()
		except MercadonaError as err:
			raise HomeAssistantError(f"Mercadona: {err}") from err
		return {
			"regulars_count": len(coordinator.regulars),
			"shopping_lists_count": len(coordinator.shopping_lists),
			"universe_count": len(coordinator.search_universe),
		}

	hass.services.async_register(DOMAIN, SERVICE_ADD_PRODUCT, handle_add, schema=SCHEMA_NAME_QTY, supports_response=SupportsResponse.OPTIONAL)
	hass.services.async_register(DOMAIN, SERVICE_BULK_ADD, handle_bulk, schema=SCHEMA_BULK, supports_response=SupportsResponse.OPTIONAL)
	hass.services.async_register(DOMAIN, SERVICE_REMOVE_PRODUCT, handle_remove, schema=SCHEMA_NAME, supports_response=SupportsResponse.OPTIONAL)
	hass.services.async_register(DOMAIN, SERVICE_CLEAR_CART, handle_clear, schema=vol.Schema({}), supports_response=SupportsResponse.OPTIONAL)
	hass.services.async_register(DOMAIN, SERVICE_SET_QUANTITY, handle_set_qty, schema=SCHEMA_SET_QTY, supports_response=SupportsResponse.OPTIONAL)
	hass.services.async_register(DOMAIN, SERVICE_REFRESH_REGULARS, handle_refresh_regulars, schema=vol.Schema({}), supports_response=SupportsResponse.OPTIONAL)
