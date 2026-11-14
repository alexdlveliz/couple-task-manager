import { useEffect, useRef, useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { groupTasks, summarizeTasks } from "./board-view";
import { currentZone } from "./deadline";
import { displayDeadline } from "./deadline";
import {
  STATUSES,
  STATUS_LABELS,
  type Partner,
  type Task,
  type TaskStatus,
} from "../shared/contracts";

interface Props {
  tasks: Task[];
  partners: Partner[];
  offline: boolean;
  busy: boolean;
  onCreate: () => void;
  onEdit: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
}
export function Board({
  tasks,
  partners,
  offline,
  busy,
  onCreate,
  onEdit,
  onStatusChange,
}: Props) {
  const [clock, setClock] = useState(() => ({
    now: new Date().toISOString(),
    zone: currentZone(),
  }));
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    let timer: number;
    const update = () => {
      const zone = currentZone();
      const instant = Temporal.Now.instant();
      setClock({ now: instant.toString(), zone });
      const nextMidnight = instant
        .toZonedDateTimeISO(zone)
        .add({ days: 1 })
        .startOfDay()
        .toInstant();
      window.clearTimeout(timer);
      timer = window.setTimeout(
        update,
        Math.min(
          nextMidnight.epochMilliseconds - instant.epochMilliseconds + 50,
          60000,
        ),
      );
    };
    update();
    window.addEventListener("focus", update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  useEffect(() => {
    const onFocus = (event: FocusEvent) => {
      if (!pendingFocus.current) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        target !== document.body &&
        target.dataset.taskId !== pendingFocus.current
      )
        pendingFocus.current = null;
    };
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("focusin", onFocus);
    };
  }, []);
  useEffect(() => {
    if (!busy && pendingFocus.current) {
      const control = document.querySelector(
        `[data-task-id="${CSS.escape(pendingFocus.current)}"]`,
      ) as unknown as HTMLSelectElement | null;
      if (control) control.focus();
      else document.getElementById("list-heading")?.focus();
      pendingFocus.current = null;
    }
  }, [busy, tasks]);
  const [status, setStatus] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const visible = tasks.filter(
    (task) =>
      (status === "all" || task.status === status) &&
      (assignee === "all" || task.assigneeUid === assignee),
  );
  const groups = groupTasks(visible, clock.now, clock.zone);
  const summary = summarizeTasks(tasks, clock.now, clock.zone);
  return (
    <section aria-label="Tareas compartidas" className="board-section">
      <div className="board-header">
        <div>
          <h2>Lo que compartimos</h2>
          <p>
            {summary.today} para hoy · {summary.inProgress} en progreso
          </p>
        </div>
        <button onClick={onCreate} disabled={offline || busy}>
          Nueva tarea
        </button>
      </div>
      <div className="filters" aria-label="Filtros de tareas">
        <fieldset>
          <legend>Estado</legend>
          <div className="filter-chips">
            {[
              { value: "all", label: "Todos" },
              ...STATUSES.map((value) => ({
                value,
                label: STATUS_LABELS[value],
              })),
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                className="filter-chip"
                aria-pressed={status === item.value}
                onClick={() => {
                  setStatus(item.value);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Responsable</legend>
          <div className="filter-chips">
            {[
              { uid: "all", displayName: "Todas las personas" },
              ...partners,
            ].map((person) => (
              <button
                key={person.uid}
                type="button"
                className="filter-chip"
                aria-pressed={assignee === person.uid}
                onClick={() => {
                  setAssignee(person.uid);
                }}
              >
                {person.displayName}
              </button>
            ))}
          </div>
        </fieldset>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setStatus("all");
            setAssignee("all");
          }}
        >
          Limpiar filtros
        </button>
      </div>
      <div className="list-heading">
        <h2 id="list-heading" tabIndex={-1}>
          Lista compartida
        </h2>
        <span>
          {visible.length} {visible.length === 1 ? "tarea" : "tareas"}
        </span>
      </div>
      {tasks.length === 0 ? (
        <p className="empty-state">
          Todavía no hay tareas. Crea una para empezar a compartir el trabajo.
        </p>
      ) : visible.length === 0 ? (
        <p className="empty-state">
          No hay tareas con estos filtros. Elige otros para ver más.
        </p>
      ) : (
        <div className="task-groups">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`group-${group.key}`}>
              <h3 id={`group-${group.key}`}>{group.label}</h3>
              <ul className="task-list">
                {group.tasks.map((task) => (
                  <li key={task.id}>
                    <article className="task">
                      <div className="task-content">
                        <h4>{task.title}</h4>
                        <p>
                          {partners.find(
                            (partner) => partner.uid === task.assigneeUid,
                          )?.displayName ?? "Persona no disponible"}
                          <span aria-hidden="true"> · </span>
                          {task.deadline
                            ? displayDeadline(task.deadline)
                            : "Sin fecha límite"}
                        </p>
                      </div>
                      <div className="task-actions">
                        <select
                          className={`task-status status-${task.status}`}
                          data-task-id={task.id}
                          aria-label={`Cambiar estado: ${task.title}`}
                          value={task.status}
                          disabled={offline || busy}
                          onChange={(event) => {
                            pendingFocus.current = task.id;
                            onStatusChange(
                              task,
                              event.target.value as TaskStatus,
                            );
                          }}
                        >
                          {STATUSES.map((item) => (
                            <option key={item} value={item}>
                              {STATUS_LABELS[item]}
                            </option>
                          ))}
                        </select>
                        <button
                          className="text-button edit-button"
                          onClick={() => {
                            onEdit(task);
                          }}
                          disabled={offline || busy}
                          aria-label={`Editar tarea: ${task.title}`}
                        >
                          Editar
                        </button>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {offline && (
        <p className="offline-note">Necesitas conexión para guardar cambios.</p>
      )}
    </section>
  );
}
