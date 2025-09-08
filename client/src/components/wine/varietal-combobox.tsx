import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { VARIETALS_SYNONYMS, VARIETALS } from "@/data/varietals";

interface VarietalComboboxProps {
  value: string[];
  onChange: (next: string[]) => void;
  maxSelected?: number;
  placeholder?: string;
  disabled?: boolean;
}

export default function VarietalCombobox({
  value,
  onChange,
  maxSelected = 3,
  placeholder = "Rebsorte suchen...",
  disabled,
}: VarietalComboboxProps) {
  const [open, setOpen] = useState(false);

  const items = useMemo(() => VARIETALS.map((name) => ({
    name,
    synonyms: VARIETALS_SYNONYMS[name] || [],
  })), []);

  const toggle = (name: string) => {
    const exists = value.includes(name);
    if (exists) {
      onChange(value.filter((v) => v !== name));
      return;
    }
    if (value.length >= maxSelected) {
      // do nothing if over the max; keep open so user can deselect
      return;
    }
    onChange([...value, name]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="w-full justify-between" disabled={disabled}>
          <span className="text-left truncate mr-2">
            {value.length === 0
              ? "Rebsorte hinzufügen"
              : `${value.length} von ${maxSelected} ausgewählt`}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>Keine Rebsorte gefunden.</CommandEmpty>
            <CommandGroup>
              {items.map(({ name, synonyms }) => (
                <CommandItem key={name} value={`${name} ${synonyms.join(" ")}`} onSelect={() => toggle(name)}>
                  <Check className={cn("mr-2 h-4 w-4", value.includes(name) ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span>{name}</span>
                    {synonyms.length > 0 && (
                      <span className="text-xs text-muted-foreground">{synonyms.join(", ")}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
