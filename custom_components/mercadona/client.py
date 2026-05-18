"""Cliente HTTP asincrono para tienda.mercadona.es.

Maneja login con user+password (validado 2026-05-16), auto-relogin al recibir 401,
y todas las operaciones de Mis Habituales y carrito necesarias para la integracion.
"""
from __future__ import annotations

import base64
import binascii
import json
import logging
import time
from typing import Any

import aiohttp

from .const import BASE_URL, DEFAULT_WAREHOUSE, TOKEN_REFRESH_MARGIN

_LOGGER = logging.getLogger(__name__)


class MercadonaError(Exception):
	"""Error generico de la integracion Mercadona."""


class MercadonaAuthError(MercadonaError):
	"""Credenciales invalidas o token caducado sin posibilidad de relogin."""


class MercadonaApiError(MercadonaError):
	"""Error en una llamada API distinto de auth."""

	def __init__(self, message: str, status: int, body: str) -> None:
		super().__init__(message)
		self.status = status
		self.body = body


def _decode_jwt_payload(token: str) -> dict[str, Any]:
	"""Decodifica el payload del JWT sin verificar firma (solo necesitamos `exp`)."""
	parts = token.split(".")
	if len(parts) != 3:
		raise ValueError("JWT con formato invalido")
	payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
	try:
		raw = base64.urlsafe_b64decode(payload_b64)
	except binascii.Error as err:
		raise ValueError("JWT base64 invalido") from err
	return json.loads(raw)


class MercadonaClient:
	"""Cliente autenticado contra la API de Mercadona."""

	def __init__(
		self,
		session: aiohttp.ClientSession,
		*,
		username: str,
		password: str,
		token: str | None = None,
		customer_uuid: str | None = None,
	) -> None:
		self._session = session
		self._username = username
		self._password = password
		self._token: str | None = token
		self._customer_uuid: str | None = customer_uuid
		self._token_exp: float | None = None
		if token:
			self._update_token_exp(token)

	@property
	def token(self) -> str | None:
		return self._token

	@property
	def customer_uuid(self) -> str | None:
		return self._customer_uuid

	@property
	def token_exp(self) -> float | None:
		return self._token_exp

	def _update_token_exp(self, token: str) -> None:
		try:
			payload = _decode_jwt_payload(token)
			self._token_exp = float(payload.get("exp", 0))
			if not self._customer_uuid:
				self._customer_uuid = payload.get("customer_uuid")
		except (ValueError, json.JSONDecodeError) as err:
			_LOGGER.warning("No se pudo decodificar exp del JWT: %s", err)
			self._token_exp = None

	def _token_is_fresh(self) -> bool:
		if not self._token or not self._token_exp:
			return False
		return self._token_exp - time.time() > TOKEN_REFRESH_MARGIN.total_seconds()

	async def login(self) -> None:
		"""Hace login con user+password y guarda el token + customer_uuid."""
		url = f"{BASE_URL}/auth/tokens/"
		body = {"username": self._username, "password": self._password}
		try:
			async with self._session.post(url, json=body) as resp:
				text = await resp.text()
				if resp.status == 400:
					raise MercadonaAuthError(
						f"Credenciales rechazadas por Mercadona (HTTP 400): {text[:200]}"
					)
				if resp.status != 200:
					raise MercadonaApiError(
						f"Login fallo con HTTP {resp.status}", resp.status, text[:500]
					)
				data = json.loads(text)
		except aiohttp.ClientError as err:
			raise MercadonaApiError(f"Error de red en login: {err}", 0, "") from err

		token = data.get("access_token")
		customer_id = data.get("customer_id")
		if not token or not customer_id:
			raise MercadonaApiError(
				"Respuesta de login sin access_token o customer_id", 200, text[:500]
			)
		self._token = token
		self._customer_uuid = customer_id
		self._update_token_exp(token)
		_LOGGER.info("Login Mercadona OK. Token valido hasta exp=%s", self._token_exp)

	async def ensure_authenticated(self) -> None:
		"""Garantiza un token vivo. Hace login si no hay token o esta cerca de caducar."""
		if not self._token_is_fresh():
			await self.login()

	async def _request(
		self, method: str, path: str, *, json_body: Any | None = None, retry: bool = True
	) -> Any:
		await self.ensure_authenticated()
		url = f"{BASE_URL}{path}"
		headers = {"Authorization": f"Bearer {self._token}"}
		if json_body is not None:
			headers["Content-Type"] = "application/json"

		try:
			async with self._session.request(
				method, url, headers=headers, json=json_body
			) as resp:
				text = await resp.text()
				if resp.status == 401:
					if retry:
						_LOGGER.info("401 recibido, forzando relogin y reintentando")
						await self.login()
						return await self._request(method, path, json_body=json_body, retry=False)
					raise MercadonaAuthError(
						f"401 tras relogin en {method} {path}: {text[:200]}"
					)
				if not resp.ok:
					raise MercadonaApiError(
						f"Error {resp.status} en {method} {path}", resp.status, text[:500]
					)
				if not text:
					return None
				return json.loads(text)
		except aiohttp.ClientError as err:
			raise MercadonaApiError(f"Error de red en {method} {path}: {err}", 0, "") from err

	# --- Operaciones de alto nivel ---------------------------------------

	async def get_customer(self) -> dict[str, Any]:
		return await self._request("GET", f"/customers/{self._customer_uuid}/")

	async def get_myregulars(self, type_: str = "precision") -> dict[str, Any]:
		return await self._request(
			"GET",
			f"/customers/{self._customer_uuid}/recommendations/myregulars/{type_}/",
		)

	async def list_shopping_lists(self, wh: str = DEFAULT_WAREHOUSE) -> dict[str, Any]:
		"""Indice de listas personalizadas del usuario.

		Respuesta: {"shopping_lists": [{"id", "name", "thumbnail_images", "products_quantity"}]}.
		Si el cliente no tiene listas, devuelve {"shopping_lists": []} (caso normal).
		"""
		return await self._request(
			"GET",
			f"/customers/{self._customer_uuid}/shopping-lists/?lang=es&wh={wh}",
		)

	async def get_shopping_list(
		self, list_id: str, wh: str = DEFAULT_WAREHOUSE
	) -> dict[str, Any]:
		"""Detalle de una lista personalizada (incluye `products`).

		Los `Product` tienen el mismo schema que el `product` dentro de
		MyRegularItem, reutilizable por el matcher sin transformacion.
		"""
		return await self._request(
			"GET",
			f"/customers/{self._customer_uuid}/shopping-lists/{list_id}/?lang=es&wh={wh}",
		)

	async def get_cart(self) -> dict[str, Any]:
		return await self._request("GET", f"/customers/{self._customer_uuid}/cart/")

	async def put_cart(self, body: dict[str, Any]) -> dict[str, Any]:
		return await self._request(
			"PUT", f"/customers/{self._customer_uuid}/cart/", json_body=body
		)

	# --- Helpers de carrito (port literal del cliente TS) ----------------

	@staticmethod
	def _line_from_existing(line: dict[str, Any]) -> dict[str, Any]:
		return {
			"quantity": line["quantity"],
			"product_id": line["product"]["id"],
			"sources": list(line.get("sources", [])),
			"version": line["version"],
		}

	async def add_to_cart(self, product_id: str, quantity: int) -> dict[str, Any]:
		"""Anade `quantity` unidades. Si la linea existe, suma; si no, la crea."""
		if not isinstance(quantity, int) or quantity < 1:
			raise ValueError(f"quantity debe ser entero >= 1, recibido: {quantity}")
		cart = await self.get_cart()
		lines: list[dict[str, Any]] = []
		merged = False
		for line in cart["lines"]:
			if line["product"]["id"] == product_id:
				merged = True
				lines.append({
					"quantity": line["quantity"] + quantity,
					"product_id": product_id,
					"sources": list(line.get("sources", [])) + ["+MR"] * quantity,
					"version": line["version"],
				})
			else:
				lines.append(self._line_from_existing(line))
		if not merged:
			lines.append({
				"quantity": quantity,
				"product_id": product_id,
				"sources": ["+MR"] * quantity,
			})
		return await self.put_cart({"id": cart["id"], "version": cart["version"], "lines": lines})

	async def add_multiple_to_cart(
		self, items: list[tuple[str, int]]
	) -> dict[str, Any]:
		"""Anade varios productos en UN solo PUT (lo que necesita la automatizacion bulk)."""
		if not items:
			return await self.get_cart()
		cart = await self.get_cart()
		additions = {pid: qty for pid, qty in items}
		lines: list[dict[str, Any]] = []
		for line in cart["lines"]:
			pid = line["product"]["id"]
			if pid in additions:
				qty = additions.pop(pid)
				lines.append({
					"quantity": line["quantity"] + qty,
					"product_id": pid,
					"sources": list(line.get("sources", [])) + ["+MR"] * qty,
					"version": line["version"],
				})
			else:
				lines.append(self._line_from_existing(line))
		for pid, qty in additions.items():
			lines.append({
				"quantity": qty,
				"product_id": pid,
				"sources": ["+MR"] * qty,
			})
		return await self.put_cart({"id": cart["id"], "version": cart["version"], "lines": lines})

	async def remove_from_cart(self, product_id: str) -> dict[str, Any]:
		cart = await self.get_cart()
		filtered = [l for l in cart["lines"] if l["product"]["id"] != product_id]
		if len(filtered) == len(cart["lines"]):
			return cart
		lines = [self._line_from_existing(l) for l in filtered]
		return await self.put_cart({"id": cart["id"], "version": cart["version"], "lines": lines})

	async def clear_cart(self) -> dict[str, Any]:
		cart = await self.get_cart()
		return await self.put_cart({"id": cart["id"], "version": cart["version"], "lines": []})

	async def set_cart_line_quantity(self, product_id: str, quantity: int) -> dict[str, Any]:
		"""Fija la cantidad exacta. Si quantity == 0, elimina la linea."""
		if not isinstance(quantity, int) or quantity < 0:
			raise ValueError(f"quantity debe ser entero >= 0, recibido: {quantity}")
		cart = await self.get_cart()
		lines: list[dict[str, Any]] = []
		found = False
		for line in cart["lines"]:
			if line["product"]["id"] != product_id:
				lines.append(self._line_from_existing(line))
				continue
			found = True
			if quantity == 0:
				continue
			sources = list(line.get("sources", []))
			if quantity > line["quantity"]:
				sources.extend(["+MR"] * (quantity - int(line["quantity"])))
			elif quantity < line["quantity"]:
				sources = sources[:quantity]
			lines.append({
				"quantity": quantity,
				"product_id": product_id,
				"sources": sources,
				"version": line["version"],
			})
		if not found and quantity > 0:
			lines.append({
				"quantity": quantity,
				"product_id": product_id,
				"sources": ["+MR"] * quantity,
			})
		return await self.put_cart({"id": cart["id"], "version": cart["version"], "lines": lines})
