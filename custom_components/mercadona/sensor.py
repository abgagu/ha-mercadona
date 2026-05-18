"""Sensores: total del carrito y faltante hasta el minimo de pedido."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CURRENCY_EURO
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN, MIN_ORDER_EUR
from .coordinator import MercadonaCoordinator


async def async_setup_entry(
	hass: HomeAssistant,
	entry: ConfigEntry,
	async_add_entities: AddEntitiesCallback,
) -> None:
	coordinator: MercadonaCoordinator = hass.data[DOMAIN][entry.entry_id][DATA_COORDINATOR]
	async_add_entities([
		CartTotalSensor(coordinator, entry.entry_id),
		MinimumGapSensor(coordinator, entry.entry_id),
	])


def _cart_total(coordinator: MercadonaCoordinator) -> float:
	data = coordinator.data or {}
	cart = data.get("cart") or {}
	summary = cart.get("summary") or {}
	try:
		return float(summary.get("total", 0))
	except (TypeError, ValueError):
		return 0.0


class _Base(CoordinatorEntity[MercadonaCoordinator], SensorEntity):
	_attr_has_entity_name = True
	_attr_native_unit_of_measurement = CURRENCY_EURO
	_attr_state_class = SensorStateClass.MEASUREMENT

	def __init__(self, coordinator: MercadonaCoordinator, entry_id: str, key: str) -> None:
		super().__init__(coordinator)
		self._attr_unique_id = f"{entry_id}_{key}"
		self._attr_device_info = DeviceInfo(
			identifiers={(DOMAIN, entry_id)},
			name="Mercadona",
			manufacturer="Mercadona",
			entry_type=DeviceEntryType.SERVICE,
		)


def _to_float(value, default: float = 0.0) -> float:
	try:
		return float(value)
	except (TypeError, ValueError):
		return default


def _cart_lines(coordinator: MercadonaCoordinator) -> list[dict]:
	"""Resumen de cada linea para consumo del frontend/cards."""
	cart = (coordinator.data or {}).get("cart") or {}
	out: list[dict] = []
	for line in cart.get("lines", []):
		prod = line.get("product") or {}
		qty = _to_float(line.get("quantity"))
		pi = prod.get("price_instructions") or {}
		unit_price = _to_float(pi.get("unit_price"))
		out.append({
			"product_id": prod.get("id"),
			"display_name": prod.get("display_name"),
			"quantity": qty,
			"unit_price": round(unit_price, 2),
			"line_total": round(qty * unit_price, 2),
			"thumbnail": prod.get("thumbnail"),
		})
	return out


class CartTotalSensor(_Base):
	_attr_translation_key = "cart_total"
	_attr_icon = "mdi:cart"

	def __init__(self, coordinator: MercadonaCoordinator, entry_id: str) -> None:
		super().__init__(coordinator, entry_id, "cart_total")

	@property
	def native_value(self) -> float:
		return round(_cart_total(self.coordinator), 2)

	@property
	def extra_state_attributes(self) -> dict:
		cart = (self.coordinator.data or {}).get("cart") or {}
		return {
			"products_count": cart.get("products_count", 0),
			"cart_id": cart.get("id"),
			"version": cart.get("version"),
			"lines": _cart_lines(self.coordinator),
		}


class MinimumGapSensor(_Base):
	_attr_translation_key = "minimum_gap"
	_attr_icon = "mdi:cart-arrow-up"

	def __init__(self, coordinator: MercadonaCoordinator, entry_id: str) -> None:
		super().__init__(coordinator, entry_id, "minimum_gap")

	@property
	def native_value(self) -> float:
		gap = MIN_ORDER_EUR - _cart_total(self.coordinator)
		return round(max(gap, 0.0), 2)

	@property
	def extra_state_attributes(self) -> dict:
		return {"minimum_order": MIN_ORDER_EUR}
