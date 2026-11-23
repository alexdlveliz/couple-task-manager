import { useEffect, useRef, useState } from "react";
import { displayDeadline } from "./deadline";
import {
  STATUSES,
  STATUS_LABELS,
  type Partner,
  type Task,
  type TaskStatus,
} from "../shared/contracts";

interface Props {
  groups: { key: TaskStatus; tasks: Task[] }[];
  labels: Record<TaskStatus, string>;
  partners: Partner[];
  disabled: boolean;
  onEdit: (task: Task) => void;
  onMove: (task: Task, status: TaskStatus) => void;
}

export function Kanban({
  groups,
  labels,
  partners,
  disabled,
  onEdit,
  onMove,
}: Props) {
  const drag = useRef<{ task: Task; pointer: number } | null>(null);
  const scrollTimer = useRef<number | null>(null);
  const stopScrolling = () => {
    if (scrollTimer.current !== null) window.clearInterval(scrollTimer.current);
    scrollTimer.current = null;
  };
  const [dragging, setDragging] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (scrollTimer.current !== null)
        window.clearInterval(scrollTimer.current);
    },
    [],
  );
  return (
    <>
      <nav className="kanban-nav" aria-label="Ir a columna">
        {groups.map(({ key, tasks }) => (
          <button
            key={key}
            type="button"
            className="filter-chip"
            onClick={() =>
              document
                .getElementById(`column-${key}`)
                ?.scrollIntoView({ block: "nearest", inline: "start" })
            }
          >
            {labels[key]} <span>{tasks.length}</span>
          </button>
        ))}
      </nav>
      <div className={`kanban-columns${dragging ? " is-dragging" : ""}`}>
        {groups.map(({ key, tasks }) => (
          <section
            className="kanban-column"
            id={`column-${key}`}
            key={key}
            aria-labelledby={`column-heading-${key}`}
          >
            <h3 id={`column-heading-${key}`}>
              {labels[key]} <span>{tasks.length}</span>
            </h3>
            {tasks.length === 0 ? (
              <p className="empty-state">No hay tareas en este estado.</p>
            ) : (
              <ul>
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    className={`kanban-card${dragging === task.id ? " is-dragging" : ""}`}
                    data-draggable={!disabled}
                    onPointerDown={(event) => {
                      if (
                        disabled ||
                        event.button !== 0 ||
                        (event.target as HTMLElement).closest(
                          "button, select, input, textarea, a",
                        )
                      )
                        return;
                      drag.current = { task, pointer: event.pointerId };
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setDragging(task.id);
                    }}
                    onPointerMove={(event) => {
                      if (!drag.current) return;
                      const scroller =
                        event.currentTarget.closest(".kanban-columns");
                      if (!scroller) return;
                      const bounds = scroller.getBoundingClientRect();
                      const direction =
                        event.clientX < bounds.left + 48
                          ? -1
                          : event.clientX > bounds.right - 48
                            ? 1
                            : 0;
                      stopScrolling();
                      if (direction)
                        scrollTimer.current = window.setInterval(() => {
                          scroller.scrollLeft += direction * 12;
                        }, 30);
                    }}
                    onPointerUp={(event) => {
                      stopScrolling();
                      if (
                        !drag.current ||
                        drag.current.pointer !== event.pointerId
                      )
                        return;
                      const target = document
                        .elementFromPoint(event.clientX, event.clientY)
                        ?.closest<HTMLElement>(".kanban-column");
                      const status = target?.id.replace("column-", "") as
                        TaskStatus | undefined;
                      const moved = drag.current.task;
                      drag.current = null;
                      setDragging(null);
                      if (
                        !disabled &&
                        status &&
                        STATUSES.includes(status) &&
                        status !== moved.status
                      )
                        onMove(moved, status);
                    }}
                    onPointerCancel={() => {
                      stopScrolling();
                      drag.current = null;
                      setDragging(null);
                    }}
                  >
                    <article>
                      <div className="kanban-card-heading">
                        <h4>{task.title}</h4>
                        {task.visibility === "private" && <span>Privada</span>}
                      </div>
                      <p>
                        {partners.find(
                          (person) => person.uid === task.assigneeUid,
                        )?.displayName ?? "Persona no disponible"}{" "}
                        ·{" "}
                        {task.deadline
                          ? displayDeadline(task.deadline)
                          : "Sin fecha límite"}
                      </p>
                      <div className="task-actions">
                        <select
                          className={`task-status status-${task.status}`}
                          data-task-id={task.id}
                          aria-label={`Cambiar estado: ${task.title}`}
                          value={task.status}
                          disabled={disabled}
                          onChange={(event) => {
                            onMove(task, event.target.value as TaskStatus);
                          }}
                        >
                          {STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="text-button edit-button"
                          disabled={disabled}
                          aria-label={`Editar tarea: ${task.title}`}
                          onClick={() => {
                            onEdit(task);
                          }}
                        >
                          Editar
                        </button>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
