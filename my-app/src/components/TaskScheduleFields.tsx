import { Calendar, type DateRange } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type TaskScheduleFieldsProps = {
  plannedRange: DateRange | undefined
  onPlannedRangeChange: (range: DateRange | undefined) => void
  startTime: string
  endTime: string
  onStartTimeChange: (value: string) => void
  onEndTimeChange: (value: string) => void
  timeInvalid?: boolean
}

export default function TaskScheduleFields({
  plannedRange,
  onPlannedRangeChange,
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  timeInvalid,
}: TaskScheduleFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>日付</Label>
        <Calendar
          mode="range"
          numberOfMonths={1}
          selected={plannedRange}
          onSelect={onPlannedRangeChange}
          defaultMonth={plannedRange?.from ?? undefined}
          initialFocus
          className="rounded-2xl border border-border bg-card p-4 md:p-6 shadow-sm"
        />
      </div>
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="task-start">開始時刻</Label>
          <Input
            id="task-start"
            type="time"
            value={startTime}
            step={300}
            onChange={(event) => onStartTimeChange(event.target.value)}
          />
        </div>
        <div className="hidden pb-3 text-sm text-muted-foreground sm:block">〜</div>
        <div className="flex-1 space-y-2">
          <Label htmlFor="task-end">終了時刻</Label>
          <Input
            id="task-end"
            type="time"
            value={endTime}
            step={300}
            onChange={(event) => onEndTimeChange(event.target.value)}
          />
        </div>
      </div>
      {timeInvalid ? (
        <p className="text-xs text-destructive sm:text-sm">
          終了時刻は開始時刻より後に設定してください。
        </p>
      ) : null}
    </div>
  )
}


