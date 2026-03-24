// src/components/ui/multi-select.tsx
"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MultiSelectProps {
  options: { value: string | number; label: string }[];
  selected: (string | number)[];
  onChange: (selected: (string | number)[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select items...",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const selectedItems = options.filter((option) => selected.includes(option.value));

  const handleUnselect = (item: typeof options[0]) => {
    onChange(selected.filter((i) => i !== item.value));
  };

  const handleSelect = (item: typeof options[0]) => {
    if (selected.includes(item.value)) {
      handleUnselect(item);
    } else {
      onChange([...selected, item.value]);
    }
    setInputValue("");
  };

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div className={cn("w-full", className)}>
      <Command className="overflow-visible bg-transparent">
        <div className="group border border-input px-3 py-2 rounded-md text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          <div className="flex gap-1 flex-wrap">
            {selectedItems.map((item) => (
              <Badge key={item.value} variant="secondary" className="rounded-sm px-2 py-1">
                {item.label}
                <button
                  className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleUnselect(item);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={() => handleUnselect(item)}
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </Badge>
            ))}
            <CommandInput
              placeholder={selectedItems.length === 0 ? placeholder : ""}
              value={inputValue}
              onValueChange={setInputValue}
              onBlur={() => setOpen(false)}
              onFocus={() => setOpen(true)}
              className="bg-transparent outline-none placeholder:text-muted-foreground flex-1"
            />
          </div>
        </div>

        <div className="relative mt-2">
          {open && filteredOptions.length > 0 && (
            <div className="absolute w-full z-10 top-0 rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in">
              <CommandList>
                <CommandGroup className="h-full overflow-auto">
                  {filteredOptions.map((option) => {
                    const isSelected = selected.includes(option.value);
                    return (
                      <CommandItem
                        key={option.value}
                        onMouseDown={(e: { preventDefault: () => void; stopPropagation: () => void; }) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onSelect={() => handleSelect(option)}
                        className={cn(
                          "cursor-pointer",
                          isSelected && "bg-accent text-accent-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {isSelected && <div className="h-4 w-4 rounded-sm border-2 border-primary bg-primary" />}
                          {!isSelected && <div className="h-4 w-4 rounded-sm border-2 border-input" />}
                          {option.label}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </div>
          )}
        </div>
      </Command>
    </div>
  );
}