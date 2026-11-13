import { displayDeadline } from "./deadline";
import {
  STATUSES,
  STATUS_LABELS,
  type Partner,
  type Task,
} from "../shared/contracts";

interface Props {
  tasks: Task[];
  partners: Partner[];
  offline: boolean;
  onCreate: () => void;
  onEdit: (task: Task) => void;
}
export function Board({ tasks, partners, offline, onCreate, onEdit }: Props) {
  return (
    <section aria-label="Tareas compartidas">
      <div className="board-header">
        <div>
          <h2>Tareas compartidas</h2>
          <p>Lo que hacemos, en un mismo lugar.</p>
        </div>
        <button onClick={onCreate} disabled={offline}>
          Nueva tarea
        </button>
      </div>
      {tasks.length === 0 && <p>Todavía no hay tareas.</p>}
      <div className="board">
        {STATUSES.map((status) => {
          const group = tasks.filter((task) => task.status === status);
          return (
            <section
              className="group"
              key={status}
              aria-labelledby={`group-${status}`}
            >
              <h3 id={`group-${status}`}>
                {STATUS_LABELS[status]}{" "}
                <span className="count">{group.length}</span>
              </h3>
              <ul>
                {group.map((task) => (
                  <li key={task.id}>
                    <article className="task">
                      <h4>{task.title}</h4>
                      <p>
                        {partners.find(
                          (partner) => partner.uid === task.assigneeUid,
                        )?.displayName ?? "Persona no disponible"}
                      </p>
                      <p>
                        {task.deadline
                          ? displayDeadline(task.deadline)
                          : "Sin fecha límite"}
                      </p>
                      <button
                        className="secondary"
                        onClick={() => {
                          onEdit(task);
                        }}
                        disabled={offline}
                        aria-label={`Editar tarea: ${task.title}`}
                      >
                        Editar tarea
                      </button>
                    </article>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}
