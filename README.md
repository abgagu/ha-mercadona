<div align="center">
  <img width="160" alt="Logo Mercadona" src="https://raw.githubusercontent.com/abgagu/ha-mercadona/main/img/logo.png">
</div>

# Mercadona para Home Assistant

Integración personalizada (HACS) que conecta tu cuenta de [tienda.mercadona.es](https://tienda.mercadona.es) con Home Assistant. Permite añadir productos al carrito desde automatizaciones, idealmente para volcar de golpe tu lista de la compra al carrito de Mercadona.

> Esta integración no está afiliada ni respaldada por Mercadona, S.A. Usa el API privado de su tienda online y puede dejar de funcionar si Mercadona la modifica.

## Requisitos

- Home Assistant 2024.4 o superior.
- Cuenta de Mercadona con la web `tienda.mercadona.es` operativa para tu código postal.
- HACS instalado (opcional pero recomendado).

## Instalación

### HACS (recomendado)

Asegúrate de tener [HACS](https://hacs.xyz/) instalado.

#### Añadir la integración vía HACS

Con HACS instalado, pulsa este botón:

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=abgagu&repository=ha-mercadona&category=integration)

1. Pulsa **Add**.
2. Pulsa el botón **Download** abajo a la derecha.
3. Reinicia Home Assistant.
4. Configura la integración en **Settings → Devices & Services → + Add Integration → Mercadona**.
5. Introduce email + contraseña de tu cuenta.

<details>
<summary>Añadir el repositorio manualmente a HACS</summary>

1. Abre HACS en Home Assistant.
2. Pulsa el `...` arriba a la derecha → **Custom repositories**.
3. Añade la URL `https://github.com/abgagu/ha-mercadona`.
4. Categoría: **Integration**, y pulsa Add.
5. Busca "Mercadona" en HACS y pulsa **Download**.
6. Reinicia Home Assistant.
7. Configura la integración en **Settings → Devices & Services**.

</details>

<details>
<summary>Instalación 100% manual (sin HACS)</summary>

1. Copia la carpeta `custom_components/mercadona/` de este repositorio dentro de `<config>/custom_components/` de tu instalación de Home Assistant.
2. Reinicia Home Assistant.
3. Añade la integración desde **Settings → Devices & Services**.

</details>

## Configuración

Solo necesitas tu email y contraseña de Mercadona. Se guardan cifrados por Home Assistant y se usan únicamente para autenticar contra el API de la tienda online. El token de sesión se renueva automáticamente cuando hace falta; no tienes que hacer nada cada cierto tiempo.

## Entidades

| Entidad | Tipo | Qué expone |
|---|---|---|
| `sensor.mercadona_total_del_carrito` | sensor (€) | Suma del carrito actual. |
| `sensor.mercadona_faltante_hasta_el_minimo` | sensor (€) | Lo que falta para alcanzar el pedido mínimo (60 €). 0 si ya se ha superado. |
| `binary_sensor.mercadona_minimo_de_pedido_alcanzado` | binary_sensor | `on` si el carrito ≥ 60 €. |

El carrito se actualiza cada 5 minutos.

## Servicios

Todos los servicios viven en el dominio `mercadona` y devuelven respuesta (`response_variable`) para que tu automatización pueda notificarte el resultado.

### `mercadona.add_product`

Busca un producto y añade `quantity` unidades. Acepta **`name`** (busca en tu universo: Mis Habituales + listas personalizadas de la web) o **`product_id`** (resolución directa, sin pasar por el matcher; útil tras una desambiguación). Si omites `quantity` se usa la cantidad recomendada del producto (1 por defecto para items que vienen solo de listas personalizadas).

```yaml
service: mercadona.add_product
data:
  name: kefir desnatado
  quantity: 2
response_variable: result
```

```yaml
service: mercadona.add_product
data:
  product_id: "12345"
  quantity: 1
```

### `mercadona.bulk_add` — el caso de uso principal

Acepta una lista de strings o de objetos `{name, quantity}` o `{product_id, quantity}`. Hace una sola operación contra Mercadona con todo el lote.

Devuelve:

```yaml
added:
  - {query, matched, product_id, quantity, recommended_quantity}   # añadidos correctamente
not_found:
  - "<nombre que no apareció en tus listas>"
ambiguous:
  - query: "<nombre original>"
    candidates:
      - {display_name, product_id, recommended_quantity}           # candidatos para desambiguar
```

Si una entrada es ambigua, el `product_id` de cada candidato te permite reintentar con `bulk_add` (o `add_product`) pasando ya el id elegido. Así evitas que un segundo intento por nombre vuelva a ser ambiguo.

```yaml
service: mercadona.bulk_add
data:
  items:
    - leche
    - { name: kefir, quantity: 2 }
    - { product_id: "12345", quantity: 1 }   # ya resuelto previamente
response_variable: result
```

### Ejemplo: volcar una lista de la compra (p.ej. la de Alexa) al carrito

Asumiendo que tienes tu lista de la compra como entidad `todo.*` (por ejemplo `todo.alexa_shopping_list` si usas la integración de Alexa Media Player):

```yaml
alias: Volcar lista de la compra a Mercadona
trigger:
  - platform: state
    entity_id: input_button.volcar_lista
action:
  - service: todo.get_items
    target:
      entity_id: todo.alexa_shopping_list
    response_variable: lista
  - service: mercadona.bulk_add
    data:
      items: >-
        {{ lista['todo.alexa_shopping_list']['items'] | map(attribute='summary') | list }}
    response_variable: resultado
  - service: notify.persistent_notification
    data:
      title: Carrito Mercadona actualizado
      message: >-
        Añadidos: {{ resultado.added | length }}.
        No encontrados: {{ resultado.not_found | join(', ') }}.
        Ambiguos: {{ resultado.ambiguous | length }}.
```

### Otros servicios

| Servicio | Argumentos | Qué hace |
|---|---|---|
| `mercadona.remove_product` | `name` o `product_id` | Elimina la línea del carrito. |
| `mercadona.set_quantity` | (`name` o `product_id`) + `quantity` | Fija la cantidad exacta. `0` elimina la línea. |
| `mercadona.clear_cart` | — | Vacía el carrito. |
| `mercadona.refresh_regulars` | — | Fuerza recarga del universo de búsqueda (Mis Habituales + listas personalizadas; normalmente se cachea 1 hora). |

Todos los servicios que aceptan `name` aceptan también `product_id` como alternativa. Pasar `product_id` resuelve directamente sin usar el matcher (recomendado tras una desambiguación).

## Cómo busca los productos

La integración busca en un **universo acotado** compuesto por:

1. **Mis Habituales** (la lista que Mercadona genera automáticamente con lo que compras).
2. **Listas personalizadas** del usuario — las que creas a mano desde la pestaña "Listas" de [tienda.mercadona.es](https://tienda.mercadona.es). Esto te permite **ampliar el universo sin tocar código**: si un producto no aparece en tus habituales pero quieres usarlo por nombre desde HA, créate una lista en la web (puede llamarse como quieras) y mételo ahí.

Si un producto está en ambos sitios, gana habituales (preserva la cantidad recomendada). Los items que solo vienen de listas personalizadas usan cantidad recomendada = 1.

### El matcher

- Ignora acentos y mayúsculas/minúsculas.
- Ignora marcas (Hacendado, Deliplus, Bosque Verde…) y descriptores de envase (pack, bote, kg…).
- Maneja singulares y plurales, y un diccionario de sinónimos por palabra (emental→emmental, yoghurt→bífidus…) y por raíz (plátano→banana, fresa→fresón, papa→patata, yogur→bífidus, desgrasado→desnatado…).
- **Modificadores estrictos**: si pides "salmón fresco" no te ofrece "Salmón ahumado"; si pides "leche en polvo" no te devuelve la líquida; si pides "leche desnatada" descarta semi y entera. Cubre estado de pescados/carnes, tipo de grasa en lácteos, pan blanco/integral, formato (polvo/líquido/pastilla/cápsulas…) y tomate (natural/frito/triturado/concentrado).
- Si una consulta encaja con varios productos, el servicio devuelve **todos** los candidatos empatados como ambiguos para que tu script (o el panel) desambigüe — no se elige uno al azar.

Si pides un producto que no está en ninguna de tus dos fuentes, el matcher devolverá `not_found`. Las opciones son: (a) añadirlo a una lista personalizada en la web, o (b) comprarlo una vez para que entre en Mis Habituales.

## Panel "Mercadona"

Tras instalar la integración aparece automáticamente una entrada **Mercadona** en el sidebar de Home Assistant con un panel dedicado, sin necesidad de instalar nada más.

El panel tiene dos columnas:

- **Lista pendiente** (izquierda): items de tu lista de la compra (autodetecta una entidad `todo.*`; si tienes varias, selector para elegir, persistido por navegador). Cada fila tiene un botón `→` que dispara la búsqueda en tu universo (Mis Habituales + listas personalizadas) en modo `dry_run` y muestra la resolución **inline**:
  - **Verde**: producto único encontrado.
  - **Naranja**: ambiguo — dropdown con los candidatos para elegir.
  - **Rojo**: no encontrado en tus listas.
  Cada fila tiene editor de cantidad y botones `✓` (añadir al carrito) y `×` (descartar). Botón global `✓ Añadir N al carrito` arriba para confirmar todos los resueltos de golpe.
  
  Los items confirmados se añaden al carrito de Mercadona y **se marcan automáticamente como completados en tu lista todo** original.

- **Carrito** (derecha): líneas actuales del carrito de Mercadona con thumbnail, precio unitario, editor de cantidad y eliminar.

Arriba a la derecha: total del carrito y faltante para el pedido mínimo (60 €).

### Configuración opcional del panel

Si el panel no autodetecta tu lista correctamente o quieres forzar otro sensor, edita el config_entry de la integración. Para casos avanzados (forzar `cart_entity` o `alexa_entity`) se pueden pasar como `config` al registro del panel — abre un issue si lo necesitas.

## Soporte

Si algo no funciona o quieres pedir una mejora, abre un issue en [GitHub](https://github.com/abgagu/ha-mercadona/issues).

## Licencia

MIT.
