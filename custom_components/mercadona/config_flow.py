"""Config flow para Mercadona."""
from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_PASSWORD, CONF_USERNAME
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .client import MercadonaApiError, MercadonaAuthError, MercadonaClient
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

STEP_USER_SCHEMA = vol.Schema({
	vol.Required(CONF_USERNAME): str,
	vol.Required(CONF_PASSWORD): str,
})


class MercadonaConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
	"""Flujo de configuracion: pide email + password y valida con login."""

	VERSION = 1

	async def async_step_user(self, user_input: dict[str, Any] | None = None) -> FlowResult:
		errors: dict[str, str] = {}
		if user_input is not None:
			username = user_input[CONF_USERNAME].strip()
			password = user_input[CONF_PASSWORD]
			session = async_get_clientsession(self.hass)
			client = MercadonaClient(session, username=username, password=password)
			try:
				await client.login()
			except MercadonaAuthError:
				errors["base"] = "invalid_auth"
			except MercadonaApiError as err:
				_LOGGER.warning("Login Mercadona fallo: %s", err)
				errors["base"] = "cannot_connect"
			else:
				await self.async_set_unique_id(client.customer_uuid)
				self._abort_if_unique_id_configured()
				return self.async_create_entry(
					title=f"Mercadona ({username})",
					data={CONF_USERNAME: username, CONF_PASSWORD: password},
				)

		return self.async_show_form(
			step_id="user", data_schema=STEP_USER_SCHEMA, errors=errors
		)
