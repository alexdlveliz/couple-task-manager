import { useState } from "react";
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
  const [status, setStatus] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const visible = tasks.filter(
    (task) =>
      (status === "all" || task.status === status) &&
      (assignee === "all" || task.assigneeUid === assignee),
  );
  return (
    <section aria-label="Tareas compartidas" className="board-section">
      <div className="board-header">
        <div>
          <h2>Tareas compartidas</h2>
          <p>Lo que hacemos, en un mismo lugar.</p>
        </div>
        <button onClick={onCreate} disabled={offline || busy}>
          Nueva tarea
        </button>
      </div>
      <div className="filters" aria-label="Filtros de tareas">
        <label>
          Estado
          <select
            aria-label="Filtrar por estado"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
            }}
          >
            <option value="all">Todos los estados</option>
            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {STATUS_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Responsable
          <select
            aria-label="Filtrar por responsable"
            value={assignee}
            onChange={(event) => {
              setAssignee(event.target.value);
            }}
          >
            <option value="all">Todas las personas</option>
            {partners.map((partner) => (
              <option key={partner.uid} value={partner.uid}>
                {partner.displayName}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="list-heading">
        <h3>Lista compartida</h3>
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
        <ul className="task-list">
          {visible.map((task) => (
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
                    aria-label={`Cambiar estado: ${task.title}`}
                    value={task.status}
                    disabled={offline || busy}
                    onChange={(event) => {
                      onStatusChange(task, event.target.value as TaskStatus);
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
      )}
      {offline && (
        <p className="offline-note">Necesitas conexión para guardar cambios.</p>
      )}
    </section>
  );
}
