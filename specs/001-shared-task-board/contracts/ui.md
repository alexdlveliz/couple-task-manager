# Spanish UI Contract

## Accounts and board

Show “Iniciar sesión”, labeled “Correo electrónico” and “Contraseña”, “Entrar”, and “Cerrar sesión”. Onboarding explains “Este tablero es privado para dos personas. Usa la cuenta que se te proporcionó.” There is no registration link. Translate Firebase error codes to Spanish; never display raw SDK errors. Invalid login: “No se pudo iniciar sesión. Revisa tus datos.” Authorization rejection: “Esta cuenta no tiene acceso al tablero.”

After authorization, show all tasks in a shared list with optional status and assignee filters. Expose “Por hacer” (`todo`), “En progreso” (`in_progress`), “Bloqueada” (`blocked`), and “Completada” (`completed`) as text and allow a direct status change for each task. Empty board: “Todavía no hay tareas.” Each card exposes title, assignee name, status as text and deadline or “Sin fecha límite”. Both partners can edit any card, including tasks assigned to the other partner. Expose “Nueva tarea”, “Editar tarea”, “Actualizar”, and “Guardar”; no deletion control.

Forms require labeled “Título” and “Responsable”; editing also has “Estado”. Deadline controls are optional “Fecha límite” and “Hora límite”, with “Quitar fecha límite”. Creation starts in “Por hacer”. Blank/whitespace title: “Escribe un título.” Missing or unauthorized assignee: “Selecciona una persona autorizada.” Link inline errors to fields; focus the first invalid field. Preserve form values on failed saves. Do not overwrite an open draft when polling updates the board.

## Synchronization states

| Condition | Visible Spanish content | Behavior |
|-----------|-------------------------|----------|
| Initial load | “Cargando tareas…” | No private cached data before account initialization |
| Current | “Actualizado” and “Última sincronización: …” | Last successful full/conditional verification time |
| Refresh in progress | “Actualizando…” | One in-flight refresh; preserve board |
| Offline cached view | “Sin conexión. Los datos pueden estar desactualizados.” | Show all cached tasks and last-sync time; disable create, edit and save controls |
| Offline interaction | “Necesitas conexión para guardar cambios.” | No writes or queued edits |
| Refresh failure | “No se pudo actualizar. Los datos pueden estar desactualizados.” | Keep prior board, show retry through “Actualizar” |
| Save pending | “Guardando…” | Prevent duplicate submission; do not announce success yet |
| Save confirmed | “Cambios guardados.” | Immediate full refresh; sync failure remains independently visible |
| Save rejected/uncertain | “No se pudo confirmar el guardado. Actualiza el tablero antes de intentarlo de nuevo.” | Retain draft; refresh to reconcile; do not automatically retry POST |
| Storage unavailable | “No se pudieron guardar los datos en este dispositivo. La consulta sin conexión puede no estar disponible.” | Online board still works; do not claim persistence |
| Cache cleanup failed | “No se pudieron borrar los datos locales. No se mostrará la copia guardada.” | Hide private state and block restore until cleanup succeeds when a pending-cleanup marker can be persisted; see data-model.md for the accepted all-storage-failed limitation |
| No offline snapshot | “No hay tareas guardadas en este dispositivo. Conéctate para cargar el tablero.” | Never show another account's snapshot |
| Shell never installed | Browser-native offline screen may appear | First-ever disconnected navigation cannot execute an uncached app |
| Session rejected | “Tu sesión ya no es válida. Inicia sesión de nuevo.” | Clear private state/cache; stop refreshes |

Online status is only a hint: failed network requests must show synchronization failure even if `navigator.onLine` is true. Each request times out after 10 seconds. Poll visible boards every 15 seconds; refresh on focus, reconnect, successful save, and “Actualizar”. Hidden tabs stop scheduled polling. Coalesce simultaneous triggers without overlapping requests; pending immediate triggers run once after the active refresh. Repeated failures retain stale indicators, never imply empty board. SDK token refresh may happen before requests; a definitive API 401/403 purges private data. 5xx, network errors and certificate-service unavailability retain stale viewing rather than purge it.

Auth changes invalidate in-flight results before rendering or storage. Sign-out/cache invalidation propagates across tabs. A saved fragment may appear as confirmed feedback, but cannot advance a complete snapshot's revision. Offline viewing is available only for the persisted previously authorized signed-in UID. A user without a persisted session must reconnect to sign in.

## Deadlines

Entry and display use current device time zone. Show IANA identifier and offset adjacent to date/time controls and each displayed deadline, e.g. “America/Guatemala (UTC−06:00)”. Offset is calculated for the deadline date, including DST. API sends UTC `Z` instants; no deadline sends null. Removing a deadline clears both controls.

Nonexistent local time: “Esta hora no existe en tu zona horaria. Elige otra hora.” Repeated local time: “Esta hora ocurre dos veces. Se usará la primera, con desfase UTC−04:00.” Substitute the actual offset. Changed device zone during editing: “La zona horaria del dispositivo cambió. Revisa la fecha y la hora antes de guardar.” Require review before saving changed local deadline fields. Unchanged deadlines keep their exact instant. Past deadlines remain valid.

## Accessibility and mobile acceptance

Use `lang="es"`, semantic headings/landmarks and native buttons/inputs; accessible names match visible Spanish labels. The shared list has a heading and visible result count; status and assignee filters are labeled. Do not require drag/drop for status or reassignment. All actions work with keyboard alone; visible focus, logical order, modal focus containment/return and Escape behavior are required. Announce save/sync status using polite live regions and validation failures with alerts; avoid repeated poll announcements. Expose busy, disabled, selected and validation states programmatically; stale state is text, never color alone.

Minimum 44 × 44 CSS-pixel touch targets, readable 16px base text, sufficient contrast, usable 320px width and 200% text zoom. Mobile layout presents a single task list without losing any tasks. Check keyboard and screen reader operation manually in addition to automated checks. Both partners must independently create, assign and complete in under two minutes without assistance.
