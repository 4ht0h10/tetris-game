---
name: clima
description: Obtiene el tiempo actual y la previsión de los próximos días para la zona del usuario (detectada por IP) o para la ciudad indicada. Úsala cuando el usuario pregunte por el tiempo, el clima, la temperatura, si va a llover, etc., o invoque /clima.
argument-hint: "[ciudad] (opcional; por defecto, tu ubicación detectada por IP)"
allowed-tools: Bash(curl:*)
---

# Clima

Consulta el tiempo con el servicio gratuito [wttr.in](https://wttr.in) (no necesita API key).

## Ubicación

- Si el usuario pasa una ciudad en `$ARGUMENTS`, úsala. Sustituye los espacios por `+` (p. ej. `San+Sebastian`).
- Si no, deja la ubicación vacía: wttr.in detecta la zona por la IP pública.

## Pasos

1. Pide los datos en JSON y en español:

   ```bash
   curl -s "https://wttr.in/<ciudad>?format=j1&lang=es"
   ```

   Sin ciudad: `curl -s "https://wttr.in/?format=j1&lang=es"`

2. Del JSON, extrae:
   - `nearest_area[0]`: `areaName`, `region`, `country` → la ubicación que se ha resuelto.
   - `current_condition[0]`: `temp_C`, `FeelsLikeC`, `lang_es[0].value` (descripción), `humidity`, `windspeedKmph`, `winddir16Point`, `precipMM`, `uvIndex`.
   - `weather[0..2]`: `date`, `mintempC`, `maxtempC` y, de `hourly`, el `chanceofrain` máximo y la descripción más representativa (`lang_es`).

3. Si la respuesta está vacía o no es JSON válido, prueba el formato de texto de una línea como alternativa:

   ```bash
   curl -s "https://wttr.in/<ciudad>?format=%l:+%c+%t+(sensación+%f),+humedad+%h,+viento+%w,+lluvia+%p&lang=es"
   ```

   Si también falla, di que el servicio no está disponible y no inventes datos.

## Formato de la respuesta

Responde siempre en español y de forma breve:

```
📍 <Ciudad>, <Región>, <País>

Ahora: <descripción>, <temp> °C (sensación <feels> °C)
Humedad <h> % · Viento <v> km/h <dir> · UV <uv>

Próximos días:
- <día de la semana> <fecha>: <min>–<max> °C, <descripción>, lluvia <p> %
- ...
```

Si la ubicación se detectó por IP, avisa en una línea de que puede no ser exacta (sobre todo con VPN) y de que se puede indicar una ciudad: `/clima Madrid`.
