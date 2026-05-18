"""Matcher de consultas de texto contra productos del universo de busqueda.

Algoritmo (v3): tres capas superpuestas.

1. Normalizacion + tokenizacion + stop-words + singularizacion heuristica.
2. Sinonimos (SYNONYMS palabra completa + STEM_SYNONYMS por raiz).
3. Filtro de modificadores estrictos (STRICT_CATEGORIES) + regla complementaria
   nonStrictMatches.
4. Scoring (coverage, pos_quality) ordenado lexicograficamente.

Por cada producto candidato calcula:
  - coverage     = fraccion de tokens de la consulta que matchean (0..1)
  - pos_quality  = media de pesos posicionales de los matches (0..1)

Donde el peso posicional depende de la posicion del token EN LA LISTA DE TOKENS
SIGNIFICATIVOS del producto (es decir, tras filtrar stop_words):

  pos 0  -> 1.0
  pos 1  -> 0.7
  pos 2  -> 0.5
  pos 3  -> 0.3
  pos 4+ -> 0.2
  solo substring (no token alineado) -> 0.2

Empata: (coverage desc, pos_quality desc, num_tokens_significativos_producto asc).
"""
from __future__ import annotations

import math
import re
import unicodedata
from dataclasses import dataclass
from typing import Any

from .synonyms import STEM_SYNONYMS, STRICT_CATEGORIES, SYNONYMS

# Sufijos flexivos cortos en espanol. Se usan tanto para detectar si un token
# coincide con un stem (en `_token_matches_stem`) como para expandir un stem
# destino a todas sus formas posibles (en `_expand_stem`).
INFLECTION_SUFFIXES: tuple[str, ...] = ("", "o", "a", "e", "os", "as", "es", "s")
_STEM_SUFFIX_RE = re.compile(r"^(o|a|e|os|as|es|s|)$")

STOP_WORDS: frozenset[str] = frozenset({
	"hacendado", "deliplus", "bosque", "verde", "compy", "milbona",
	"ud", "uds", "unidad", "unidades", "pack", "paquete", "bote", "botella",
	"bandeja", "tarrina", "tarro", "caja", "frasco", "spray", "pieza", "granel",
	"gr", "g", "gramos", "kg", "kilo", "kilos", "ml", "mililitros", "l", "litro", "litros",
	"de", "del", "la", "el", "los", "las", "y", "con", "sin", "para", "al", "a",
})

_NON_ALNUM = re.compile(r"[^a-z0-9\s]")
_WHITESPACE = re.compile(r"\s+")

_POSITION_WEIGHTS: tuple[float, ...] = (1.0, 0.7, 0.5, 0.3, 0.2)
_SUBSTRING_WEIGHT: float = 0.2

_TIER_EPSILON: float = 1e-9


def _strip_diacritics(s: str) -> str:
	return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def normalize(text: str) -> str:
	out = _strip_diacritics(text.lower())
	out = _NON_ALNUM.sub(" ", out)
	out = _WHITESPACE.sub(" ", out)
	return out.strip()


def tokenize(text: str) -> list[str]:
	return [t for t in normalize(text).split(" ") if t]


def meaningful_tokens(text: str) -> list[str]:
	return [t for t in tokenize(text) if t not in STOP_WORDS and len(t) >= 2]


def _singularize(t: str) -> str | None:
	if t.endswith("es") and len(t) > 3:
		return t[:-2]
	if t.endswith("s") and len(t) > 2:
		return t[:-1]
	return None


def _token_matches_stem(token: str, stem: str) -> bool:
	"""token comienza por stem y el sufijo restante es flexivo corto."""
	if not token.startswith(stem):
		return False
	return bool(_STEM_SUFFIX_RE.match(token[len(stem):]))


def _expand_stem(stem: str) -> list[str]:
	return [stem + s for s in INFLECTION_SUFFIXES]


def token_forms(t: str) -> list[str]:
	"""Formas alternativas de un token:

	- el token original
	- su singularizacion heuristica
	- su sinonimo de palabra completa (SYNONYMS), si existe + su singular
	- todas las inflexiones cortas del stem destino para cada entrada de
	  STEM_SYNONYMS cuya clave coincida con el token (prefijo + sufijo flexivo)
	"""
	out: set[str] = {t}
	sing = _singularize(t)
	if sing:
		out.add(sing)
	syn = SYNONYMS.get(t) or (SYNONYMS.get(sing) if sing else None)
	if syn:
		out.add(syn)
		syn_sing = _singularize(syn)
		if syn_sing:
			out.add(syn_sing)
	for q_stem, p_stem in STEM_SYNONYMS.items():
		if _token_matches_stem(t, q_stem):
			out.update(_expand_stem(p_stem))
	return list(out)


def _position_weight(pos: int) -> float:
	if pos < 0:
		return 0.0
	if pos >= len(_POSITION_WEIGHTS):
		return _POSITION_WEIGHTS[-1]
	return _POSITION_WEIGHTS[pos]


def _is_strict_token(token: str) -> bool:
	"""True si el token coincide con algun stem de STRICT_CATEGORIES."""
	for category in STRICT_CATEGORIES:
		for stem in category.keys():
			if _token_matches_stem(token, stem):
				return True
	return False


def _passes_strict_rules(query_tokens: list[str], product_tokens: list[str]) -> bool:
	"""Aplica las reglas de modificadores estrictos.

	Para cada categoria en la que el query contenga al menos un stem:
	  - Stems del query con flag=1 -> exigir presencia en el producto.
	  - Cualquier OTRO stem de la categoria (no mencionado en query) que
		aparezca en el producto -> descartar el producto.
	"""
	for category in STRICT_CATEGORIES:
		# Iterar stems mas largos primero para evitar prefijos solapados
		# (semidesnatad antes que desnatad).
		stems = sorted(category.keys(), key=len, reverse=True)
		query_stems = [s for s in stems if any(_token_matches_stem(t, s) for t in query_tokens)]
		if not query_stems:
			continue

		for qs in query_stems:
			if category[qs] == 1 and not any(_token_matches_stem(t, qs) for t in product_tokens):
				return False

		for other_stem in stems:
			if other_stem in query_stems:
				continue
			if any(_token_matches_stem(t, other_stem) for t in product_tokens):
				return False
	return True


@dataclass
class MatchResult:
	item: dict[str, Any]
	coverage: float
	pos_quality: float

	@property
	def tier(self) -> tuple[float, float]:
		return (self.coverage, self.pos_quality)


def _best_token_weight(
	query_forms: set[str],
	product_tokens_forms: list[set[str]],
	product_raw: str,
) -> float:
	for i, pforms in enumerate(product_tokens_forms):
		if query_forms & pforms:
			return _position_weight(i)
	for f in query_forms:
		if f in product_raw:
			return _SUBSTRING_WEIGHT
	return 0.0


def find_matches(query: str, items: list[dict[str, Any]]) -> list[MatchResult]:
	"""Items ordenados por (coverage desc, pos_quality desc, len asc).

	Cada `item` debe tener `item["product"]["display_name"]` y `item["product"]["id"]`.
	"""
	query_tokens = meaningful_tokens(query)
	if not query_tokens:
		return []
	query_forms_list: list[set[str]] = [set(token_forms(t)) for t in query_tokens]
	query_token_is_strict: list[bool] = [_is_strict_token(t) for t in query_tokens]

	scored: list[MatchResult] = []
	for item in items:
		display_name = item["product"]["display_name"]
		product_raw = normalize(display_name)
		product_tokens = meaningful_tokens(display_name)
		if not _passes_strict_rules(query_tokens, product_tokens):
			continue
		product_tokens_forms: list[set[str]] = [set(token_forms(t)) for t in product_tokens]

		weights: list[float] = []
		non_strict_matches = 0
		for i, forms in enumerate(query_forms_list):
			w = _best_token_weight(forms, product_tokens_forms, product_raw)
			if w > 0:
				weights.append(w)
				if not query_token_is_strict[i]:
					non_strict_matches += 1
		if not weights:
			continue
		# Si todos los tokens que matchearon son modificadores estrictos (sin
		# que ningun token "nucleo" del query haya coincidido), el match es
		# solo por casualidad. Descartar (p.ej. "jamon ahumado" no debe
		# enganchar "Salmon ahumado").
		if non_strict_matches == 0:
			continue

		coverage = len(weights) / len(query_forms_list)
		pos_quality = sum(weights) / len(weights)
		scored.append(MatchResult(item=item, coverage=coverage, pos_quality=pos_quality))

	def sort_key(m: MatchResult) -> tuple[float, float, int]:
		return (-m.coverage, -m.pos_quality, len(meaningful_tokens(m.item["product"]["display_name"])))

	scored.sort(key=sort_key)
	return scored


def find_best_matches(query: str, items: list[dict[str, Any]]) -> list[MatchResult]:
	"""Filtra a los empatados en la mejor tupla (coverage, pos_quality)."""
	all_matches = find_matches(query, items)
	if not all_matches:
		return []
	best = all_matches[0]
	return [
		m for m in all_matches
		if math.isclose(m.coverage, best.coverage, abs_tol=_TIER_EPSILON)
		and math.isclose(m.pos_quality, best.pos_quality, abs_tol=_TIER_EPSILON)
	]
