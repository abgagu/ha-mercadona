"""Universo de busqueda unificado: Mis Habituales + listas personalizadas.

El matcher recibe este universo en vez de solo "Mis Habituales". Forma de cada
item: {"product": dict, "recommended_quantity": int}, equivalente al
`MyRegularItem` que ya consumian los servicios.

Deduplicacion por `product.id`: si un producto esta en habituales y en una
lista personalizada, gana habituales (preserva `recommended_quantity` real).
Los items procedentes de listas personalizadas usan `recommended_quantity = 1`
(la API de listas no expone una cantidad recomendada).
"""
from __future__ import annotations

from typing import Any


def build_search_universe(
	regulars: list[dict[str, Any]],
	shopping_lists: list[dict[str, Any]],
) -> list[dict[str, Any]]:
	"""Fusiona habituales + listas personalizadas deduplicado por product.id.

	`regulars`: items con la forma de MyRegularItem (`{product, recommended_quantity, ...}`).
	`shopping_lists`: detalles de listas personalizadas (`{id, name, products: [...]}`).
	"""
	by_id: dict[str, dict[str, Any]] = {}
	for r in regulars:
		product = r.get("product") or {}
		pid = product.get("id")
		if not pid:
			continue
		by_id[pid] = {
			"product": product,
			"recommended_quantity": r.get("recommended_quantity", 1),
		}
	for lst in shopping_lists:
		for p in lst.get("products", []):
			pid = p.get("id")
			if not pid or pid in by_id:
				continue
			by_id[pid] = {"product": p, "recommended_quantity": 1}
	return list(by_id.values())
