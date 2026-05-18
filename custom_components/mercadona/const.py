"""Constantes de la integración Mercadona."""
from __future__ import annotations

from datetime import timedelta

DOMAIN = "mercadona"
PLATFORMS = ["sensor", "binary_sensor"]

BASE_URL = "https://tienda.mercadona.es/api"

# Warehouse por defecto. El catálogo de Mercadona depende del wh, pero para los
# endpoints que la integración usa hoy (shopping-lists) el wh sólo afecta a
# flags como `published`; el matching nominal funciona aunque no encaje
# perfectamente. Si en el futuro se añade resolución dinámica (ver
# ../Alexa-Mercadona/src/skill/warehouse-cache.ts), reemplazar este uso.
DEFAULT_WAREHOUSE = "mad1"

CONF_USERNAME = "username"
CONF_PASSWORD = "password"

DATA_COORDINATOR = "coordinator"
DATA_CLIENT = "client"

MIN_ORDER_EUR = 60.0
# TTL del universo de busqueda (Mis Habituales + listas personalizadas). Ambas
# fuentes se recargan juntas tras este intervalo.
UNIVERSE_TTL = timedelta(hours=1)
CART_UPDATE_INTERVAL = timedelta(minutes=5)

# Margen de seguridad antes de considerar el JWT como caducado.
TOKEN_REFRESH_MARGIN = timedelta(hours=24)

SERVICE_ADD_PRODUCT = "add_product"
SERVICE_BULK_ADD = "bulk_add"
SERVICE_REMOVE_PRODUCT = "remove_product"
SERVICE_CLEAR_CART = "clear_cart"
SERVICE_SET_QUANTITY = "set_quantity"
SERVICE_REFRESH_REGULARS = "refresh_regulars"
