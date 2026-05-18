"""Coordinator que cachea Mis Habituales, listas personalizadas y el carrito."""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .client import MercadonaClient, MercadonaError
from .const import CART_UPDATE_INTERVAL, DOMAIN, UNIVERSE_TTL
from .search_universe import build_search_universe

_LOGGER = logging.getLogger(__name__)


class MercadonaCoordinator(DataUpdateCoordinator[dict[str, Any]]):
	"""Refresca el carrito cada N minutos. Habituales y listas cada hora.

	El universo de busqueda (habituales + listas personalizadas) se reconstruye
	on-the-fly cada vez que se accede via `search_universe` — operacion barata.
	"""

	def __init__(self, hass: HomeAssistant, client: MercadonaClient) -> None:
		super().__init__(
			hass,
			_LOGGER,
			name=DOMAIN,
			update_interval=CART_UPDATE_INTERVAL,
		)
		self.client = client
		self._regulars: list[dict[str, Any]] = []
		self._shopping_lists: list[dict[str, Any]] = []
		self._universe_fetched_at: float = 0.0

	@property
	def regulars(self) -> list[dict[str, Any]]:
		return self._regulars

	@property
	def shopping_lists(self) -> list[dict[str, Any]]:
		"""Detalles (con products) de las listas personalizadas del usuario."""
		return self._shopping_lists

	@property
	def search_universe(self) -> list[dict[str, Any]]:
		"""Universo unificado para el matcher (habituales + listas personalizadas)."""
		return build_search_universe(self._regulars, self._shopping_lists)

	async def _async_update_data(self) -> dict[str, Any]:
		try:
			cart = await self.client.get_cart()
			if self._needs_universe_refresh():
				await self._refresh_universe()
			return {"cart": cart}
		except MercadonaError as err:
			raise UpdateFailed(str(err)) from err

	def _needs_universe_refresh(self) -> bool:
		return (time.time() - self._universe_fetched_at) > UNIVERSE_TTL.total_seconds()

	async def _refresh_universe(self) -> None:
		"""Recarga habituales + listas personalizadas en paralelo.

		Las dos fuentes son independientes: si las listas fallan, se preservan
		habituales (y viceversa). Solo si AMBAS fallan se propaga el error.
		"""
		regulars_resp, lists_resp = await asyncio.gather(
			self.client.get_myregulars(),
			self._fetch_shopping_lists(),
			return_exceptions=True,
		)

		fatal: Exception | None = None
		if isinstance(regulars_resp, BaseException):
			_LOGGER.warning("Fallo al recargar Mis Habituales: %s", regulars_resp)
			fatal = regulars_resp if not self._regulars else None
		else:
			self._regulars = regulars_resp.get("results", [])

		if isinstance(lists_resp, BaseException):
			_LOGGER.warning("Fallo al recargar listas personalizadas: %s", lists_resp)
			# Conservamos las listas previas (si las hay) y seguimos.
		else:
			self._shopping_lists = lists_resp

		if fatal is not None:
			raise fatal

		self._universe_fetched_at = time.time()
		_LOGGER.debug(
			"Universo recargado: %d habituales + %d listas personalizadas",
			len(self._regulars), len(self._shopping_lists),
		)

	async def _fetch_shopping_lists(self) -> list[dict[str, Any]]:
		"""Indice de listas + detalle de cada una en paralelo. Sin listas → [].

		Si un detalle individual falla, se omite esa lista (warning) y se
		devuelven las que si cargaron. Si el indice falla, propaga la excepcion
		para que `_refresh_universe` la maneje como fallo de la fuente.
		"""
		index = await self.client.list_shopping_lists()
		lists_meta = index.get("shopping_lists", [])
		if not lists_meta:
			return []
		details = await asyncio.gather(
			*(self.client.get_shopping_list(lst["id"]) for lst in lists_meta),
			return_exceptions=True,
		)
		out: list[dict[str, Any]] = []
		for meta, detail in zip(lists_meta, details):
			if isinstance(detail, BaseException):
				_LOGGER.warning(
					"Fallo al recargar lista personalizada %s (%s): %s",
					meta.get("name"), meta.get("id"), detail,
				)
				continue
			out.append(detail)
		return out

	async def async_refresh_regulars(self) -> None:
		"""Fuerza recarga inmediata del universo (servicio publico).

		El nombre se conserva por compatibilidad con el servicio
		`mercadona.refresh_regulars`, pero recarga TODO el universo.
		"""
		await self._refresh_universe()
