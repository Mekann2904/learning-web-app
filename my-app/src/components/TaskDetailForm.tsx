import TaskEditorForm from "@/components/TaskEditorForm"

type TaskDetailFormProps = {
  taskId: string
}

export default function TaskDetailForm({ taskId }: TaskDetailFormProps) {
  return <TaskEditorForm mode="edit" taskId={taskId} />
}
