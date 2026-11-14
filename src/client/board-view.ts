import { Temporal } from "@js-temporal/polyfill";
import type { Task } from "../shared/contracts";

const dateInZone = (instant: string, zone: string) =>
  Temporal.Instant.from(instant).toZonedDateTimeISO(zone).toPlainDate();

export function groupTasks(tasks: Task[], now: string, zone: string) {
  const today = dateInZone(now, zone);
  const groups = [
    { key: "overdue", label: "Vencidas", tasks: [] as Task[] },
    { key: "today", label: "Hoy", tasks: [] as Task[] },
    { key: "upcoming", label: "Próximas", tasks: [] as Task[] },
    { key: "undated", label: "Sin fecha", tasks: [] as Task[] },
    { key: "completed", label: "Completadas", tasks: [] as Task[] },
  ];
  for (const task of tasks) {
    const comparison = task.deadline
      ? Temporal.PlainDate.compare(dateInZone(task.deadline, zone), today)
      : 0;
    const index =
      task.status === "completed"
        ? 4
        : !task.deadline
          ? 3
          : comparison < 0
            ? 0
            : comparison === 0
              ? 1
              : 2;
    groups[index].tasks.push(task);
  }
  return groups.filter((group) => group.tasks.length > 0);
}

export function summarizeTasks(tasks: Task[], now: string, zone: string) {
  const today = dateInZone(now, zone);
  return {
    today: tasks.filter(
      (task) =>
        task.status !== "completed" &&
        task.deadline &&
        Temporal.PlainDate.compare(dateInZone(task.deadline, zone), today) ===
          0,
    ).length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
  };
}
