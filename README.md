# Centro de Control Logístico · Chile

Dashboard ejecutivo estático (HTML + CSS + JavaScript puro) para publicar en **GitHub Pages** sin backend. Lee `data/historico.json` y calcula KPIs de operación, costos, cubicación y cumplimiento SLA, con gráficos en Chart.js.

## Archivos

- `index.html` — estructura del dashboard.
- `style.css` — diseño tipo centro de control ejecutivo, responsive.
- `script.js` — carga de datos, KPIs, filtros, SLA y gráficos.
- `data/historico.json` — operaciones (exportadas desde Excel/SharePoint). Incluye datos de ejemplo de 3 años.
- `data/sla.json` — tabla de referencia de SLA 2026.

## Publicar en GitHub Pages

1. Sube los archivos a un repositorio.
2. Settings → Pages → Source: rama `main`, carpeta `/root`.
3. Abre la URL `https://<usuario>.github.io/<repo>/`.

> Para probar localmente, sírvelo por HTTP (no abras el `index.html` con `file://`, el `fetch` fallará):
> `python3 -m http.server 8000` y abre `http://localhost:8000`.

## Indicadores (KPIs)

- Total de operaciones (despacho único) y total de bultos
- Peso total (kg) y volumen total (m³)
- Gasto logístico total (valorFlete)
- Costo promedio por kg y por m³
- Tiempo promedio de tránsito (fechaAceptacion − fechaIngreso)
- % SLA cumplido, % fuera de SLA y días promedio de atraso

## Gráficos

Operaciones por mes · Gasto logístico por mes · Peso transportado por mes · Top proveedores por gasto · Top países de origen · Vías de transporte · Cumplimiento SLA.

## Filtros

Año · Proveedor · País de origen · Vía de transporte · Cumplimiento SLA. Botón **Limpiar** para reiniciar.

## Esquema de `data/historico.json`

Lista de objetos con estos campos (los numéricos faltantes se tratan como 0; las fechas inválidas se ignoran sin romper el dashboard):

| Campo | Tipo | Notas |
|---|---|---|
| `despacho` | texto | identificador único de la operación |
| `fechaIngreso` | fecha `YYYY-MM-DD` | inicio del tránsito |
| `fechaAceptacion` | fecha `YYYY-MM-DD` | fin del tránsito |
| `fechaEta` | fecha `YYYY-MM-DD` | estimada |
| `proveedor` | texto | |
| `puertoEmbarque` | texto | |
| `paisOrigen` | texto | |
| `puertoDestino` | texto | |
| `viaTransporte` | texto | Marítimo / Aéreo / Courier / Nacional / etc. |
| `valorFlete` | número | CLP |
| `valorCif` | número | CLP |
| `pesoKg` | número | |
| `volumenM3` | número | |
| `totalBultos` | número | |
| `slaDias` | número | SLA en días; si es 0 la operación se marca "Sin SLA" |

## Conexión a SharePoint (Power Automate)

El dashboard solo necesita que `data/historico.json` esté actualizado. Flujo sugerido:

1. Mantén el Excel maestro en SharePoint.
2. Power Automate (programado): leer la tabla → mapear a los campos del esquema → generar el array JSON.
3. Commit del archivo al repositorio (acción de GitHub o API) en `data/historico.json`.
4. GitHub Pages se actualiza automáticamente.

## Robustez

- Si el JSON falta, está vacío, no es un array o el sitio se abre con `file://`, se muestra un mensaje claro en pantalla en lugar de fallar en silencio.
- Si Chart.js no carga (CDN bloqueado), los KPIs y la tabla siguen funcionando.
- Campos numéricos ausentes → 0; fechas inválidas → ignoradas.
