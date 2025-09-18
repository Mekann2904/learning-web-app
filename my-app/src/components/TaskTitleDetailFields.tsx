import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type TaskTitleDetailFieldsProps = {
  title: string
  onTitleChange: (value: string) => void
  detail: string
  onDetailChange: (value: string) => void
  titleInputRef?: (node: HTMLInputElement | null) => void
  disabled?: boolean
  titlePlaceholder?: string
  detailPlaceholder?: string
  detailMinHeightClass?: string
}

export default function TaskTitleDetailFields({
  title,
  onTitleChange,
  detail,
  onDetailChange,
  titleInputRef,
  disabled,
  titlePlaceholder = "例: 週次ミーティングの準備",
  detailPlaceholder = "メモを記載してください",
  detailMinHeightClass,
}: TaskTitleDetailFieldsProps) {
  const minHeightClass = detailMinHeightClass ?? "min-h-[180px]"

  return (
    <div className="space-y-2.5">
      <div className="space-y-2">
        <Label htmlFor="task-title">タイトル</Label>
        <Input
          id="task-title"
          placeholder={titlePlaceholder}
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          ref={titleInputRef}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="task-detail">詳細</Label>
        <Textarea
          id="task-detail"
          placeholder={detailPlaceholder}
          value={detail}
          onChange={(event) => onDetailChange(event.target.value)}
          className={minHeightClass}
          disabled={disabled}
        />
      </div>
    </div>
  )
}


