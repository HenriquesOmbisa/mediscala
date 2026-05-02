"use client";

import * as React from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function DatePickerField({
  date,
  onSelect,
  placeholder = "Escolher data",
  disabled,
  className,
  id,
}: {
  date?: Date;
  onSelect: (d: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        type="button"
        disabled={disabled}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full justify-start gap-2 text-left font-normal rounded-xl h-11 px-4 text-[15px]",
          !date && "text-muted-foreground",
          className,
        )}
      >
        <CalendarIcon className="size-4 shrink-0 opacity-70" />
        <span className="truncate">
          {date
            ? format(date, "d MMMM yyyy", { locale: pt })
            : placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 rounded-xl" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            onSelect(d);
            setOpen(false);
          }}
          locale={pt}
          className="rounded-xl"
        />
      </PopoverContent>
    </Popover>
  );
}
