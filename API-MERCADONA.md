# API tienda.mercadona.es — Referencia técnica

Documentación de la API web de Mercadona tal como la usa el frontend de `https://tienda.mercadona.es`, observada entre mayo de 2026 y la fecha actual. **No es una API oficial.** No hay contrato público ni soporte: puede cambiar sin aviso en cualquier momento.

Este documento sirve a la integración `ha-mercadona` como referencia y, si te interesa montar tu propio cliente, te ahorra una parte del trabajo de descubrir los endpoints. La fuente de verdad técnica vive en el repo hermano `alexa-mercadona` (skill de Alexa con el mismo cliente HTTP, sincronizado manualmente).

---

## 1. Autenticación

### 1.1. Mecanismo

Todas las llamadas autenticadas se autorizan con un **JWT** en cabecera:

```
Authorization: Bearer <JWT>
```

Las cookies de sesión web (`bm_sz`, `_abck`, `__mo_da`, etc.) **no autentican** ningún endpoint de la API. Una llamada con `Authorization` válido y sin cookies funciona; al revés (cookies pero sin `Authorization`) responde `401 not_authenticated`.

El frontend almacena el token en `localStorage["MO-user"]`:

```json
{
  "uuid": "<customer_uuid>",
  "token": "<JWT>",
  "userUuid": "<customer_uuid>"
}
```

El JWT es **HS512** y su payload contiene:

```json
{
  "token_type": "access",
  "iat": 1778838310,
  "exp": 1782467110,
  "jti": "<id_unico>",
  "user_id": "<user_id>",
  "created_at": "2026-05-15 09:45:10.578120+00:00",
  "customer_uuid": "<customer_uuid>"
}
```

`exp - iat = 3 628 800 s = 42 días`. Es la vida útil que el backend asigna a cada token nuevo.

No existe endpoint de refresh: `POST /api/auth/refresh/` responde 404. Cuando un token expira, hay que volver a hacer login o capturar uno nuevo de `localStorage` desde el navegador.

### 1.2. Cómo capturar el token a mano

Si vas a usar la API desde un script o backend propio sin login programático:

1. Logueado en `https://tienda.mercadona.es/` desde Chrome.
2. F12 → **Application** → **Local Storage** → `https://tienda.mercadona.es`.
3. Clic en la clave `MO-user`. En el panel derecho ves un JSON con `uuid` y `token`.
4. Copia el valor de `token` y el de `uuid`.

Validación rápida desde terminal:

```bash
curl -s "https://tienda.mercadona.es/api/customers/$MERCADONA_CUSTOMER_UUID/" \
  -H "Authorization: Bearer $MERCADONA_BEARER"
```

Devuelve 200 con `{id, uuid, email, name, last_name, current_postal_code, cart_id, ...}` si el token sigue vivo.

### 1.3. Login programático

`POST /api/auth/tokens/` acepta `{username, password}` en JSON y devuelve un token nuevo. Funciona contra la API en una llamada aislada, sin captcha visible. Caveats:

- No está testado el comportamiento ante varios fallos seguidos (puede disparar captcha o bloqueo).
- Cualquier cambio futuro de Mercadona (captcha, 2FA, mover a OAuth contra `fed.mercadona.com`) lo rompería sin aviso.
- Obliga a almacenar la contraseña en el backend.

Esta integración SÍ lo usa: las credenciales del usuario se piden en el config flow y se guardan cifradas por Home Assistant en el config entry. El cliente hace auto-relogin al recibir 401 sin intervención del usuario. La skill hermana opta por la otra vía (captura manual cada ~40 días) por la fricción de tener credenciales planas en un Lambda alojado por Amazon.

Respuesta:

```json
{ "access_token": "<JWT>", "customer_id": "<customer_uuid>" }
```

---

## 2. Endpoints autenticados

Base: `https://tienda.mercadona.es/api/`. `<customer_uuid>` es el valor de `MO-user.uuid` (también disponible en el claim `customer_uuid` del JWT y en `customer_id` de la respuesta del login).

La UI suele añadir `?lang=es&wh=mad1` a cada llamada (`wh` es el warehouse del CP del cliente). Esos query params son **opcionales** para la mayoría de endpoints; los obligatorios se indican explícitamente abajo.

### 2.1. `GET /customers/<customer_uuid>/` — datos del cliente

Sanity check del token. Útil para obtener `cart_id` y `current_postal_code` sin tocar el carrito.

Respuesta:

```json
{
  "id": <int>,
  "uuid": "<customer_uuid>",
  "email": "...",
  "name": "...",
  "last_name": "...",
  "current_postal_code": "28000",
  "cart_id": "<cart_id>",
  "has_requested_account_deletion": false,
  "has_active_billing": true
}
```

### 2.2. `GET /customers/<customer_uuid>/recommendations/myregulars/<tipo>/` — Mis Habituales

`<tipo>` puede ser `precision` o `recall`. En la cuenta de referencia ambos devolvían exactamente la misma lista en el mismo orden, posible degeneración. Usar `precision` por defecto.

Respuesta:

```json
{
  "next_page": null,
  "results": [
    {
      "product": {
        "id": "21307",
        "display_name": "Bífidus natural probióticos Hacendado",
        "slug": "...",
        "thumbnail": "...",
        "categories": [{ "id": 11, "name": "Postres y yogures", ... }],
        "price_instructions": { ... },
        "published": true,
        "limit": 999,
        "badges": { ... },
        "unavailable_from": null,
        "unavailable_weekdays": [],
        "packaging": null
      },
      "source": "my_regulars",
      "source_code": "MR",
      "selling_method": 0,
      "recommended_quantity": 1
    },
    ...
  ]
}
```

Notas:

- En la cuenta de referencia, 140 productos en una sola respuesta (~160 KB). No hay paginación real (`next_page: null`).
- Cada item trae el objeto `product` completo: nombre, slug, categoría, packaging, precio.
- `source_code: "MR"` es lo que va luego en el campo `sources` de la línea del carrito como `"+MR"`.
- Latencia típica desde Madrid: 120–180 ms.

### 2.3. `GET /customers/<customer_uuid>/shopping-lists/?lang=es&wh=<wh>` — listas personalizadas (índice)

Listas del usuario creadas desde la pestaña "Listas" de la web (la predefinida "Mis Habituales" **no** aparece aquí; tiene endpoint propio en §2.2). El `wh` es el del cliente (ambiente).

Respuesta:

```json
{
  "shopping_lists": [
    {
      "id": "3f525297-2ce5-4cce-a85b-98eae8594129",
      "name": "Segunda lista",
      "thumbnail_images": [
        "https://prod-mercadona.imgix.net/images/...jpg?fit=crop&h=300&w=300",
        "..."
      ],
      "products_quantity": 9
    },
    {
      "id": "99dae639-3bae-446c-9d40-6e079e258fe2",
      "name": "Lista personalizada 1",
      "thumbnail_images": ["..."],
      "products_quantity": 7
    }
  ]
}
```

Notas:

- `id` es UUID v4.
- Si el usuario no tiene listas, `shopping_lists: []`.
- `thumbnail_images` son URLs de imgix; útil para UI, no para la integración.
- No trae los productos, sólo el contador. Para obtenerlos hay que pedir el detalle por id (§2.4).

### 2.4. `GET /customers/<customer_uuid>/shopping-lists/<listId>/?lang=es&wh=<wh>` — detalle de una lista

Respuesta:

```json
{
  "id": "3f525297-2ce5-4cce-a85b-98eae8594129",
  "name": "Segunda lista",
  "products_quantity": 9,
  "products": [
    {
      "id": "50971",
      "display_name": "Queso viejo tostado mezcla Hacendado",
      "slug": "queso-viejo-tostado-mezcla-hacendado-pieza",
      "thumbnail": "...",
      "categories": [ ... ],
      "price_instructions": { ... },
      "published": true,
      "limit": 999,
      "badges": { ... },
      "unavailable_from": null,
      "unavailable_weekdays": [],
      "packaging": "Pieza"
    },
    ...
  ]
}
```

Notas:

- El objeto `Product` es **exactamente el mismo schema** que el `product` que viene dentro de `MyRegularItem` en `/myregulars/precision/` (§2.2). Reutilizable por el mismo matcher sin transformación.
- No incluye un campo equivalente a `recommended_quantity` (la lista personalizada no lo modela). La integración asume 1 unidad por defecto al añadir.
- También existe `GET /customers/<uuid>/shopping-lists/<listId>/suggested-products/?lang=es&wh=<wh>` que devuelve sugerencias relacionadas con la lista. No usado por la integración.

### 2.5. `GET /customers/<customer_uuid>/cart/` — leer carrito

Respuesta:

```json
{
  "id": "<cart_id>",
  "version": 27,
  "lines": [
    {
      "quantity": 1.0,
      "sources": ["+MR"],
      "version": 22,
      "product": { /* objeto producto completo */ }
    },
    ...
  ],
  "open_order_id": null,
  "summary": { "total": "39.02" },
  "products_count": 13
}
```

Notas:

- `version` (top-level) es un contador entero que el servidor incrementa con cada modificación.
- Cada `line.version` es el contador propio de la línea (suele alinearse con la versión global del momento en que la línea se modificó por última vez).
- `sources` es un **log** de operaciones, no un origen único. Cada `"+MR"` representa un "+1 desde Mis Habituales"; cada `"-MR"`, un "-1". Para una línea nueva con cantidad neta N, basta con `["+MR"]` repetido N veces.
- `summary.total` viene como string decimal con punto.

### 2.6. `PUT /customers/<customer_uuid>/cart/` — actualizar carrito

Es un **PUT idempotente con el carrito completo**. No hay endpoint para añadir una línea de forma incremental.

Cabeceras mínimas:

```
Authorization: Bearer <JWT>
Content-Type: application/json
```

No requiere `x-version`, `x-customer-device-id`, `x-experiment-variants` ni los query params `?lang=es&wh=mad1`.

Body (ejemplo capturado de una request real al hacer "+1 Bífidus" desde la UI):

```json
{
  "id": "<cart_id>",
  "version": 25,
  "lines": [
    { "quantity": 1, "product_id": "21307", "sources": ["+MR"] },
    { "quantity": 1, "version": 22, "product_id": "23561", "sources": ["+MR"] },
    { "quantity": 3, "version": 21, "product_id": "61089", "sources": ["+MR","+MR","+MR"] },
    { "quantity": 2, "version": 9,  "product_id": "3832",  "sources": ["+SA","+SA"] }
  ]
}
```

Contrato del body:

- Las **líneas nuevas** se envían **sin** campo `version` (lo asigna el servidor).
- Las **líneas existentes** se envían con su `version` actual.
- El `version` top-level es el del carrito **antes** del cambio.
- `sources`: para una línea recién creada desde Mis Habituales, `["+MR"]` repetido `quantity` veces. Para una línea existente con histórico, lo correcto es **conservar lo que venía y añadir** los `"+MR"` adicionales.

Respuesta:

- `200 OK` con el carrito completo en formato de lectura (igual que `GET /cart/`).
- `version` incrementado en 1.
- Cabeceras informativas: `x-customer-pc: <CP>`, `x-customer-wh: <warehouse>`.

Comportamientos observados:

- Mandar `version: 1` (muy atrás) contra un carrito en `version: 27`: 200 OK. El servidor no rechaza con conflicto; reconcilia silenciosamente. **No hay control de concurrencia optimista.** Para uso personal no es problema. Si hay concurrencia con la app oficial, puede haber sobrescrituras.
- Quitar una línea → omitirla en `lines`. Para quitar 1 unidad de una línea con `quantity > 1`, enviar la línea con `quantity` reducida y añadir un `"-MR"` al final de `sources`.
- Vaciar carrito → `lines: []`.

### 2.7. `GET /customers/<customer_uuid>/addresses/?lang=es&wh=mad1` — direcciones del cliente

Lista de direcciones registradas. Necesario para resolver el `addressId` numérico que requiere el endpoint de slots.

Respuesta:

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 0,
      "address": "Calle Ejemplo, 1",
      "address_detail": "",
      "town": "Madrid",
      "comments": "",
      "entered_manually": false,
      "latitude": "0.0",
      "longitude": "0.0",
      "permanent_address": true,
      "postal_code": "28000"
    }
  ]
}
```

Notas:

- `id` es **numérico**, no UUID (a diferencia del customer).
- `permanent_address: true` marca la dirección por defecto.
- Paginación estilo DRF (`count`/`next`/`previous`).

### 2.8. `GET /customers/<customer_uuid>/addresses/<addressId>/slots/?lang=es&wh=mad1&size=1` — slots de entrega

Devuelve los huecos de entrega disponibles para una dirección concreta. Cobertura observada: ~11 días vista, saltándose días no operativos (domingos en `mad1`).

Respuesta (muestra recortada):

```json
{
  "next_page": null,
  "results": [
    {
      "id": "2745490",
      "start": "2026-05-19T19:00:00Z",
      "end":   "2026-05-19T20:00:00Z",
      "timezone": "Europe/Madrid",
      "price": "8.20",
      "available": true,
      "open": true
    },
    {
      "id": "2740364",
      "start": "2026-05-18T05:00:00Z",
      "end":   "2026-05-18T06:00:00Z",
      "timezone": "Europe/Madrid",
      "price": "8.20",
      "available": false,
      "open": false
    },
    ...
  ]
}
```

Para "primeros huecos reservables": filtrar `available === true && open === true` y ordenar por `start` ascendente.

Notas:

- Franjas de **1 hora**, horario 05:00–20:00 UTC (07:00–22:00 Madrid en horario verano).
- `available: false` puede ser slot lleno; `open: false`, slot ya cerrado (pasado o no disponible para reserva).
- `price` es string decimal con punto.
- `size=1` en la query (lo manda la UI) no limita resultados: el endpoint devolvió más de 150 entradas con `next_page: null`. Posible flag legacy o "page size de días". El parámetro parece no tener efecto observable, pero se mantiene por compatibilidad.
- Aparentemente no requiere checkout activo (la URL no incluye id de checkout). La observación se hizo dentro de un flujo de checkout, conviene confirmar.

Esta integración aún **no consume** el endpoint de slots (el panel de HA no muestra huecos de entrega todavía). Queda documentado para una futura extensión.

### 2.9. `GET /customers/<customer_uuid>/orders/?lang=es&wh=mad1&page=1[&status=2]` — pedidos del cliente

Sin `status`, devuelve todos los pedidos. Con `status=2` se filtra a "confirmados pendientes de entrega".

Campos relevantes del primer resultado de un pedido confirmado:

```json
{
  "id": 30494292,
  "status": 2,
  "status_ui": "confirmed",
  "start_date": "2026-05-19T14:00:00Z",
  "end_date":   "2026-05-19T15:00:00Z",
  "changes_until": "2026-05-18T22:59:59Z",
  "timezone": "Europe/Madrid",
  "warehouse_code": "mad1",
  "price": "71.95",
  "final_price": false,
  "products_count": 19,
  "payment_status": 0,
  "payment_method": {
    "id": 2092712,
    "credit_card_type": 2,
    "credit_card_number": "9320",
    "expires_month": "08",
    "expires_year": "2029",
    "default_card": true,
    "expiration_status": "valid"
  },
  "last_edit_message": "Pedido editado hace 16 horas."
}
```

Otros campos del objeto: `address`, `order_id`, `slot`, `slot_size`, `summary`, `customer_phone`, `phone_country_code`, `phone_national_number`, `click_and_collect`, `service_rating_token`.

Para detectar "pedido en curso modificable":

1. Llamar con `status=2`.
2. Si `results.length === 0` → no hay.
3. Si `results[0].changes_until > now` → sí, modificable.

Códigos `status` observados:

- `2` = confirmado / pendiente de entrega.
- Otros (`1` = draft, `3` = entregado, `4` = cancelado…) no validados empíricamente.

Aviso importante: los **cambios sin guardar** en el flujo de edición de un pedido **no se reflejan** en este endpoint. La API muestra el estado guardado. Las ediciones in-progress viven en el cliente (o en algún recurso `drafts` no investigado).

### 2.10. Otros endpoints autenticados (no usados por la integración)

- `GET /customers/<uuid>/orders/cart/drafts/` → 404 en la cuenta de referencia. Posible stub.
- `POST /auth/refresh/` → 404. No existe refresh de token.
- **Operaciones de escritura sobre shopping-lists** (crear, renombrar, borrar, añadir/quitar productos): no investigadas. Esta integración solo **lee** las listas personalizadas. La UI las usa con `PUT/POST/PATCH/DELETE` sobre los mismos paths de §2.3 / §2.4.

---

## 3. Endpoints públicos (sin auth)

### 3.1. `PUT /postal-codes/actions/change-pc/` — resolver warehouse desde CP

Mapea un código postal al warehouse correspondiente. La web lo usa cuando un visitante introduce su CP antes de loguearse.

Request:

```
PUT /api/postal-codes/actions/change-pc/
Content-Type: application/json

{ "new_postal_code": "28001" }
```

Response 200 (cuerpo casi inútil):

```json
{ "warehouse_changed": false }
```

**Lo importante está en los headers de respuesta**:

- `x-customer-pc: 28001`
- `x-customer-wh: mad1`

Si el CP está fuera de la zona de servicio: 404 + `{"error_msg": "This zip code is outside of our working area"}`.

Mapeo observado:

| CP             | wh    |
|----------------|-------|
| 28001 (Madrid) | mad1  |
| 08001 (Barcelona) | bcn1 |
| 46001 (Valencia)  | vlc1 |

Notas:

- `warehouse_changed` se calcula contra una cookie de sesión web previa (`__mo_da`). Desde un cliente sin cookies persistentes siempre vale `false`; el header `x-customer-wh` es siempre la fuente fiable.
- Side effect: deja cookies `__mo_da={"warehouse":"...", "postalCode":"..."}` en la sesión web. Irrelevante para un cliente que no las mantiene.

### 3.2. `GET /postal-codes/actions/retrieve-pc/<cp>/`

Valida si un CP entra dentro del área de servicio: 204 si sí, 404 si no. **No devuelve el warehouse.** Para resolver `wh`, usar `change-pc` (§3.1).

### 3.3. Otros endpoints públicos no investigados

Útiles potencialmente cuando se quiera ampliar el alcance fuera de "Mis Habituales":

- `GET /api/categories/`, `GET /api/categories/<id>/`
- `GET /api/products/<id>/`, `GET /api/products/<id>/similars/`, `GET /api/products/<id>/xselling/`
- `GET /api/home/`, `/api/home/new-arrivals/`, `/api/home/price-drops/`, `/api/home/sections/<uuid>/`

**Búsqueda de productos**: la UI usa un endpoint en `https://api.mercadona.es/` (servicio separado), no en `tienda.mercadona.es`. Pendiente de documentar.

---

## 4. Limitaciones conocidas

- **Vida del token: 42 días sin refresh.** Esta integración hace auto-relogin con las credenciales guardadas en el config entry, así que en la práctica el usuario no se entera. Si el login programático se rompe (captcha, 2FA), la integración fallará en silencio en el siguiente refresh (~24 h de margen antes de la caducidad) y habrá que recurrir a captura manual.
- **PUT del carrito sin concurrencia optimista.** Si el usuario edita simultáneamente desde la app oficial y desde HA, una escritura puede pisar a la otra sin error visible. Para uso personal no suele ser crítico.
- **`precision` y `recall` devolvieron lo mismo** en la cuenta de referencia. No se garantiza que sea así para otras cuentas. `recall` se trata como fallback informativo.
- **`sources` es un log**, no un tag. Para replicar fielmente lo que hace la UI hay que ir acumulando `"+MR"`/`"-MR"` en orden. Una integración personal puede simplificarse a `"+MR"` por unidad nueva.
- **Akamai bot manager** (`_abck`, `bm_sz`) está presente en cookies. No bloquea llamadas API con Bearer válido desde un navegador real, pero podría comportarse distinto desde IPs de cloud (AWS, Azure). Si HA corre en un servidor cloud (no en la red doméstica) y empiezan a salir errores raros (403, body con HTML, retos JS), revisar esto primero.
- **Latencia desde Madrid: 90–180 ms.** Desde HA local (RPi en la misma red doméstica que sale por una IP residencial española) la latencia se mantiene en el mismo rango. Sin timeout de plataforma (Alexa exige < 8 s; HA no).
- **Tamaño de "Mis Habituales": ~160 KB.** Conviene cachearlo y no pedirlo en cada operación. La integración lo cachea 1 hora junto con las listas personalizadas.
- **`current_postal_code` está fijado en la cuenta**. Si el cliente tiene un CP sin servicio, los endpoints de carrito pueden devolver error o `wh` distinto.
- **El catálogo varía por warehouse (`wh`)**, determinado server-side por `customer.current_postal_code`. Verificado empíricamente: ni `?wh=...` en query ni la cookie `__mo_da` cambian la respuesta de `/myregulars/` ni `/cart/` para usuarios autenticados. La única forma de cambiar el catálogo que ve un cliente logueado es **mutar `current_postal_code`** con `PUT /postal-codes/actions/change-pc/` (§3.1), lo cual persiste el cambio en la cuenta. Implicaciones:
  - En "Mis Habituales", los flags `published`, `unavailable_from` y `unavailable_weekdays` reflejan el warehouse asociado al `current_postal_code` actual.
  - Si el `current_postal_code` y la dirección de entrega elegida están en CPs servidos por warehouses distintos, los precios/disponibilidad pueden no coincidir con los reales en la entrega.
  - La integración usa `wh=mad1` hardcoded en las requests a `/shopping-lists/`. El `wh` solo afecta a flags como `published`; el matching nominal funciona aunque no encaje. Cuando se implemente resolución dinámica de wh (vía §3.1 a partir del CP del customer), reemplazar.
- **Productos sin stock**: no se ha probado empíricamente qué pasa al PUT con un `product_id` no disponible (probable que el response marque `unavailable_from` y/o rechace la línea).

---

## 5. Endpoints pendientes de investigar

- **"Añadir al pedido en curso"**: la web tiene un botón con ese nombre en el panel del carrito que dispara una secuencia aún sin capturar. Permitiría que la integración volcara el carrito en un pedido ya confirmado modificable.
- **Búsqueda en catálogo general**: usa `https://api.mercadona.es/` (subdominio distinto). Pendiente cuando se amplíe el alcance fuera del universo Mis Habituales + listas personalizadas.
- **Operaciones de escritura sobre shopping-lists**: crear/renombrar/borrar listas y añadir/quitar productos. La UI las usa pero no están capturadas. Permitirían, por ejemplo, dejar que HA gestione el universo de búsqueda sin que el usuario tenga que ir a la web.

---

## Apéndice — ejemplos con curl

Con `MERCADONA_BEARER` y `MERCADONA_CUSTOMER_UUID` exportados:

```bash
# 1) Validar token y obtener cart_id
curl -s "https://tienda.mercadona.es/api/customers/$MERCADONA_CUSTOMER_UUID/" \
  -H "Authorization: Bearer $MERCADONA_BEARER" | jq '{name, cart_id, current_postal_code}'

# 2) Listar Mis Habituales (solo id + nombre, primeras 20 entradas)
curl -s "https://tienda.mercadona.es/api/customers/$MERCADONA_CUSTOMER_UUID/recommendations/myregulars/precision/" \
  -H "Authorization: Bearer $MERCADONA_BEARER" \
  | jq '.results[] | {id: .product.id, name: .product.display_name}' | head -40

# 3) Listar listas personalizadas (índice)
curl -s "https://tienda.mercadona.es/api/customers/$MERCADONA_CUSTOMER_UUID/shopping-lists/?lang=es&wh=mad1" \
  -H "Authorization: Bearer $MERCADONA_BEARER" | jq '.shopping_lists[] | {id, name, products_quantity}'

# 4) Leer carrito
curl -s "https://tienda.mercadona.es/api/customers/$MERCADONA_CUSTOMER_UUID/cart/" \
  -H "Authorization: Bearer $MERCADONA_BEARER" \
  | jq '{id, version, products_count, total: .summary.total, lines: [.lines[] | {id: .product.id, name: .product.display_name, qty: .quantity}]}'

# 5) Añadir 1 unidad del producto 21307 (Bífidus) al carrito.
#    Hay que LEER el carrito antes, modificarlo y reenviarlo entero.
#    Ejemplo asumiendo un carrito con una sola línea previa (queso emmental 23561):
curl -s -X PUT "https://tienda.mercadona.es/api/customers/$MERCADONA_CUSTOMER_UUID/cart/" \
  -H "Authorization: Bearer $MERCADONA_BEARER" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "<cart_id>",
    "version": 25,
    "lines": [
      {"quantity": 1, "product_id": "21307", "sources": ["+MR"]},
      {"quantity": 1, "version": 22, "product_id": "23561", "sources": ["+MR"]}
    ]
  }' | jq '{version, products_count, total: .summary.total}'

# 6) Login programático (alternativa a capturar el token a mano)
curl -s -X POST "https://tienda.mercadona.es/api/auth/tokens/" \
  -H "Content-Type: application/json" \
  -d '{"username": "tu@email.com", "password": "tucontrasena"}' \
  | jq '{access_token, customer_id}'

# 7) Mapear CP a warehouse (público, sin auth)
curl -s -X PUT "https://tienda.mercadona.es/api/postal-codes/actions/change-pc/" \
  -H "Content-Type: application/json" \
  -d '{"new_postal_code": "28001"}' -i | grep -i "^x-customer-"
```
