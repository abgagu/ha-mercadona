"""Binary sensor: si el carrito alcanza el minimo de pedido."""
from __future__ import annotations

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.config_entries import ConfigEntry
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
	async_add_entities([MinOrderReachedSensor(coordinator, entry.entry_id)])


class MinOrderReachedSensor(CoordinatorEntity[MercadonaCoordinator], BinarySensorEntity):
	_attr_has_entity_name = True
	_attr_translation_key = "min_order_reached"
	_attr_icon = "mdi:cart-check"

	def __init__(self, coordinator: MercadonaCoordinator, entry_id: str) -> None:
		super().__init__(coordinator)
		self._attr_unique_id = f"{entry_id}_min_order_reached"
		self._attr_device_info = DeviceInfo(
			identifiers={(DOMAIN, entry_id)},
			name="Mercadona",
			manufacturer="Mercadona",
			entry_type=DeviceEntryType.SERVICE,
		)

	@property
	def is_on(self) -> bool:
		cart = (self.coordinator.data or {}).get("cart") or {}
		try:
			total = float((cart.get("summary") or {}).get("total", 0))
		except (TypeError, ValueError):
			total = 0.0
		return total >= MIN_ORDER_EUR
