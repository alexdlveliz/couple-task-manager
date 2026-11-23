# Private Tasks Interface Contract

This contract extends the [shared board API](../../001-shared-task-board/contracts/openapi.yaml).

| Interface | Private-task behavior |
| --- | --- |
| GET /api/tasks | Returns shared tasks and the signed-in partner's private tasks only. Each task includes `visibility`. The snapshot revision and quoted board-r ETag represent the caller's authorized view. The other partner's private writes leave the caller's existing ETag valid. |
| POST /api/tasks | Accepts optional `visibility`, default `shared`. Reject invalid values. Shared creation retains required assignee validation. Private creation may omit `assigneeUid` or submit the caller's UID. Reject a different assignee and derive ownership from authentication. |
| PUT /api/tasks/{id} | Keeps existing replacement fields. Reject attempts to set visibility or creator and attempts to change private assignment. A well-formed request targeting another partner's private task returns the same Spanish not-found response as a missing task. |
| DELETE /api/tasks/{id} | Authorize the owner for private tasks and either partner for shared tasks. A hidden task returns the same Spanish not-found response as a missing task. |
| Mutation responses | Keep existing response shapes plus task visibility where a task is returned. Report the caller's revision. Save results are partial and require full synchronization before persisting a snapshot. |

The existing Spanish form offers **Compartida** and **Privada** on creation, with **Compartida** selected initially. Private mode presents the creator as the fixed assignee. Private cards display **Privada**. Visibility is informational during editing. Preserve focus, error announcements, and touch targets.

Creation, completion, and overdue notices for private tasks address the creator only. Ordinary edits are silent. Completion with other edits produces a single completion event, independent of how many enabled devices receive delivery.
