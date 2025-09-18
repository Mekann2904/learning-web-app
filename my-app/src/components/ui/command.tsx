import * as React from "react";

import { cn } from "@/lib/utils";

type CommandProps = React.ComponentPropsWithoutRef<"div"> & {
  shouldFilter?: boolean;
  value?: string;
};

const Command = React.forwardRef<HTMLDivElement, CommandProps>(
  ({ className, shouldFilter: _shouldFilter, value: _value, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-sm",
        className
      )}
      {...props}
    />
  )
);
Command.displayName = "Command";

type CommandInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  onValueChange?: (value: string) => void;
};

const CommandInput = React.forwardRef<HTMLInputElement, CommandInputProps>(
({ className, type, onChange, onValueChange, ...props }, ref) => (
  <div className="flex items-center border-b border-border px-3 py-2">
    <input
      ref={ref}
      type={type ?? "text"}
      className={cn(
        "flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none",
        className
      )}
      onChange={(event) => {
        onChange?.(event);
        onValueChange?.(event.target.value);
      }}
      {...props}
    />
  </div>
));
CommandInput.displayName = "CommandInput";

const CommandList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="listbox"
    className={cn("flex max-h-72 flex-col overflow-y-auto", className)}
    {...props}
  />
));
CommandList.displayName = "CommandList";

const CommandEmpty = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-4 py-3 text-sm text-muted-foreground", className)}
    {...props}
  />
));
CommandEmpty.displayName = "CommandEmpty";

type CommandItemProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: string;
  onSelect?: (value: string) => void;
};

const CommandItem = React.forwardRef<HTMLDivElement, CommandItemProps>(
  ({
    className,
    children,
    value = "",
    onSelect,
    onClick,
    onMouseDown,
    ...props
  }, ref) => (
    <div
      ref={ref}
      role="option"
      tabIndex={0}
      data-value={value}
      className={cn(
        "flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground hover:bg-muted focus-visible:outline-none",
        className
      )}
      onMouseDown={(event) => {
        onMouseDown?.(event);
        event.preventDefault();
      }}
      onClick={(event) => {
        onClick?.(event);
        onSelect?.(value);
      }}
      {...props}
    >
      {children}
    </div>
  )
);
CommandItem.displayName = "CommandItem";

export { Command, CommandEmpty, CommandInput, CommandItem, CommandList };
