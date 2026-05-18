"""Diccionarios para el matcher: SYNONYMS, STEM_SYNONYMS y STRICT_CATEGORIES.

Port literal de `../Alexa-Mercadona/src/synonyms.ts`. Cualquier mejora deberia
terminar viviendo en los dos sitios.

============================================================================
SYNONYMS - sinonimos por palabra completa
============================================================================

Clave: forma normalizada (sin acentos, minusculas) que diria el usuario.
Valor: forma normalizada que aparece en el display_name del producto.

Usar SYNONYMS solo cuando:
  - El cambio es ortografico ("emental" -> "emmental") sin paradigma flexivo
	comun y, por tanto, STEM_SYNONYMS no lo puede capturar.
  - La variante es una forma morfologica distinta (diminutivo "capsulita":
	el sufijo "ita" no esta entre los flexivos cortos que admite el matcher).

IMPORTANTE: NO anadir aqui entradas que la singularizacion heuristica ya
cubre por si sola (p.ej. "manzanas -> manzana" es redundante).

============================================================================
STEM_SYNONYMS - sinonimos por raiz (stem)
============================================================================

Misma idea que SYNONYMS pero con stems en ambos lados. El matcher considera
que un token del usuario coincide con la clave si el token comienza por el
stem y el sufijo es flexivo corto (o/a/e/os/as/es/s o vacio). En tal caso,
expande tokenForms con todas las inflexiones del stem destino.

Usar STEM_SYNONYMS cuando:
  - Ambos lados comparten paradigma flexivo o/a/e/os/as/es/s.
  - El stem izquierdo no colisiona con otros stems relevantes (de
	STRICT_CATEGORIES o productos no relacionados).

El target puede tener el MISMO stem que la clave si lo unico que se busca es
normalizar genero/numero (`liquid` -> `liquid`, `camper` -> `camper`).

============================================================================
STRICT_CATEGORIES - modificadores excluyentes
============================================================================

Cada categoria es un dict cuyas claves son STEMS y cuyo valor es:
  0 -> el stem es el "valor por defecto" del producto y a menudo no aparece
	   en el display_name (p.ej. salmon fresco se vende como "Salmon"). Si
	   el usuario lo dice, NO exigimos su presencia en el producto, pero
	   descartamos cualquier producto que contenga otro stem de la misma
	   categoria.
  1 -> el stem es discriminante y, cuando se nombra el producto, aparece en
	   su display_name (p.ej. "Salmon ahumado"). Si el usuario lo dice,
	   EXIGIMOS su presencia en el producto.

En AMBOS casos, mencionar un stem de la categoria descarta cualquier
producto que contenga otro stem distinto de la misma categoria.
"""
from __future__ import annotations

SYNONYMS: dict[str, str] = {
	# --- Diminutivos y morfologia irregular ---
	"capsulita": "monodosis",  # -> "Cafe monodosis ...". `capsul` stem no captura "capsulita".

	# --- Variantes ortograficas / del ASR (sin prefijo comun con su canonico) ---
	"emental": "emmental",
	"emmenthal": "emmental",
	"ementhal": "emmental",
	"yoghurt": "bifidus",      # -> "Bifidus natural ...". `yogur` se captura por stem; "yoghurt" diverge ya en el 4 caracter.
}

STEM_SYNONYMS: dict[str, str] = {
	# Normalizacion pura de genero/numero (identidad).
	"liquid": "liquid",               # liquido/a/os/as
	"concentrad": "concentrad",       # concentrado/a/os/as
	"semidesnatad": "semidesnatad",   # semidesnatado/a/os/as
	"desnatad": "desnatad",           # desnatado/a/os/as
	"camper": "camper",               # campero/a/os/as

	# Cross-root: la variante del usuario apunta al canonico del producto.
	"desgrasad": "desnatad",          # desgrasado/a/os/as -> desnatado
	"pap": "patat",                   # papa/s -> patata (regional)
	"fres": "freson",                 # fresa/s -> freson (Mercadona vende freson)
	"habichuel": "judi",              # habichuela/s -> judia (regional)
	"frijol": "alubi",                # frijol/es -> alubia (regional)
	"porot": "alubi",                 # poroto/s -> alubia (regional)
	"platan": "banan",                # platano/s -> banana (en Espana "platano" suele ser banana)
	"cangrej": "surimi",              # cangrejo/s -> surimi (denominacion coloquial)
	"sardin": "sardinill",            # sardina/s -> sardinilla (Mercadona vende sardinilla)
	"yogur": "bifidus",               # yogur/es -> bifidus (en este surtido no hay yogur "clasico")
	"colutori": "enjuagu",            # colutorio/s -> enjuague
	"capsul": "monodosis",            # capsula/s -> monodosis (capsulita queda en SYNONYMS)
	"nuec": "nuez",                   # nueces -> nuez (singularize da "nuec", el producto es "Nuez")
}

# Cada categoria es un dict[stem, 0|1]. Ver docstring del modulo para semantica.
STRICT_CATEGORIES: list[dict[str, int]] = [
	# Estado / preparacion de pescados y carnes.
	#
	# `enlatad` y `lata` son flag=0 porque el catalogo de Mercadona apenas
	# nombra el envase en el display_name. Si el usuario dice "atun en lata",
	# no exigimos esos tokens en el producto, pero si descartamos atunes
	# ahumados/marinados/etc.
	{"fresc": 0, "congelad": 1, "ahumad": 1, "marinad": 1, "salad": 1, "curad": 1, "enlatad": 0, "lata": 0},

	# Tipo de grasa en lacteos.
	{"enter": 0, "desnatad": 1, "semidesnatad": 1},

	# Pan.
	{"blanc": 0, "integral": 1},

	# Formato fisico (sacarinas, cafe, detergentes, etc.).
	{"polvo": 1, "liquid": 1, "pastilla": 1, "sobre": 1, "granulad": 1, "monodosis": 1, "capsul": 1, "comprimid": 1},

	# Tomate procesado.
	{"natural": 0, "frit": 1, "triturad": 1, "concentrad": 1},
]
