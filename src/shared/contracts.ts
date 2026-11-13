export const STATUSES = [
  "todo",
  "in_progress",
  "blocked",
  "completed",
] as const;
export type TaskStatus = (typeof STATUSES)[number];
export interface Partner {
  uid: string;
  displayName: string;
}
export interface Task {
  id: string;
  title: string;
  assigneeUid: string;
  status: TaskStatus;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface CreateTask {
  title: string;
  assigneeUid: string;
  deadline: string | null;
}
export interface ReplaceTask extends CreateTask {
  status: TaskStatus;
}
export interface BoardSnapshot {
  tasks: Task[];
  revision: number;
}
export interface SaveResult {
  task: Task;
  revision: number;
}
export interface ApiError {
  error: { code: string; message: string; fields?: Record<string, string> };
}
export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Por hacer",
  in_progress: "En progreso",
  blocked: "Bloqueada",
  completed: "Completada",
};
