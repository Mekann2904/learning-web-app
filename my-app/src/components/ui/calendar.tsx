import * as React from "react"
import {
  DayPicker,
  type DateRange,
  type DayPickerRangeProps,
} from "react-day-picker"
import "react-day-picker/dist/style.css"

import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const { captionLayout = "dropdown-buttons", ...rest } = props
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "rounded-md border border-border bg-card p-3 shadow-sm",
        className
      )}
      captionLayout={captionLayout as CalendarProps["captionLayout"]}
      classNames={{
        months: "space-y-4",
        month: "space-y-4",
        caption: "flex items-center justify-between",
        caption_label: "text-sm font-medium",
        caption_dropdowns: "flex items-center gap-2",
        dropdown_month:
          "rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
        dropdown_year:
          "rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
        nav: "flex items-center gap-2",
        button_previous:
          "inline-flex size-7 items-center justify-center rounded-md border border-input bg-background text-sm shadow-sm transition hover:bg-accent hover:text-accent-foreground",
        button_next:
          "inline-flex size-7 items-center justify-center rounded-md border border-input bg-background text-sm shadow-sm transition hover:bg-accent hover:text-accent-foreground",
        table: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-muted-foreground text-xs font-medium w-9 h-9 flex items-center justify-center",
        head_row: "flex",
        head_cell:
          "text-muted-foreground text-xs font-medium w-9 h-9 flex items-center justify-center text-center",
        row: "flex w-full",
        cell: "relative w-9 h-9 p-0 text-center",
        day: cn(
          "inline-flex size-9 items-center justify-center rounded-full text-sm font-medium transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "aria-selected:opacity-100"
        ),
        day_button: cn(
          "size-9 rounded-full outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "aria-selected:bg-primary aria-selected:text-primary-foreground"
        ),
        day_range_start:
          "rounded-full !bg-background !text-primary ring-2 ring-primary ring-offset-2 ring-offset-background",
        day_range_end:
          "rounded-full !bg-background !text-primary ring-2 ring-primary ring-offset-2 ring-offset-background",
        day_range_middle: "rounded-full bg-primary/10 text-primary",
        day_selected:
          "rounded-full bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background",
        day_today: "border border-primary text-primary",
        day_outside: "text-muted-foreground/60",
        day_disabled: "text-muted-foreground/50",
        day_hidden: "invisible",
        ...classNames,
      }}
      {...rest}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
export type { DateRange, DayPickerRangeProps }
