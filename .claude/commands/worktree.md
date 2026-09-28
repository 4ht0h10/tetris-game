---
description: Crea un git worktree aislado en .trees/<nombre> y resuelve allí el requerimiento indicado
argument-hint: <descripción del problema o requerimiento>
allowed-tools: Bash(git worktree:*), Bash(git branch:*), Bash(git status:*), Bash(git log:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git -C:*), Bash(ls:*), Bash(mkdir:*), Read, Edit, Write, Glob, Grep
---

## Requerimiento

$ARGUMENTS

## Contexto actual

- Rama actual: !`git branch --show-current`
- Worktrees existentes: !`git worktree list`
- Estado del repo: !`git status --short`

## Instrucciones

Vas a resolver el requerimiento de arriba **de forma independiente y aislada del código principal**, trabajando exclusivamente dentro de un git worktree nuevo.

1. **Validar la entrada**: si el requerimiento está vacío, detente y pide al usuario la descripción del problema. No crees nada.

2. **Elegir el nombre** del worktree a partir del requerimiento:
   - kebab-case, en minúsculas, sin tildes ni caracteres especiales (`ñ` → `n`), 2–4 palabras, máximo ~30 caracteres.
   - Debe ser fácil de asociar al tema. Ejemplos: "añadir botón de silencio" → `boton-silencio`; "la pieza se atraviesa al rotar junto a la pared" → `fix-rotacion-pared`; "guardar récord en localStorage" → `record-localstorage`.
   - Si ya existe `.trees/<nombre>` o la rama `<nombre>` (revisa la lista de worktrees y `git branch --list <nombre>`), añade un sufijo `-2`, `-3`, …

3. **Asegurar que `.trees/` está ignorado**: si `.gitignore` no contiene `.trees/`, añádelo (en el repo principal) para no versionar los worktrees.

4. **Crear el worktree** con una rama nueva del mismo nombre, partiendo del `HEAD` actual:

   ```bash
   git worktree add .trees/<nombre> -b <nombre>
   ```

5. **Trabajar solo dentro de `.trees/<nombre>`**:
   - Todas las lecturas y ediciones de archivos deben usar rutas dentro de `.trees/<nombre>/`. No modifiques nada del directorio principal (salvo el `.gitignore` del paso 3).
   - Para comandos git usa `git -C .trees/<nombre> ...`.
   - Sigue las convenciones de `CLAUDE.md` (p. ej. subir el `?v=N` de `index.html` si cambias `game.js` o `style.css`; textos de UI en español).
   - Implementa la solución completa del requerimiento.

6. **Confirmar los cambios** en la rama del worktree con un commit descriptivo en español:

   ```bash
   git -C .trees/<nombre> add -A
   git -C .trees/<nombre> commit -m "<mensaje>"
   ```

   No hagas push ni merge a la rama principal, ni borres el worktree.

7. **Informar al usuario** (en español) de:
   - Nombre del worktree y rama creados, y la ruta `.trees/<nombre>`.
   - Resumen de los cambios realizados y archivos tocados.
   - Cómo probarlo (p. ej. `python -m http.server 8000` desde `.trees/<nombre>`).
   - Cómo integrarlo o descartarlo:
     - Integrar: `git merge <nombre>` desde la rama principal.
     - Descartar: `git worktree remove .trees/<nombre>` y `git branch -D <nombre>`.
