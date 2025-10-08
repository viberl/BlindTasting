import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

export interface ProducerSuggestion {
  name: string;
  vinaturel: boolean;
  custom: boolean;
  vinaturelCount?: number;
  customCount?: number;
  country?: string | null;
  region?: string | null;
}

const formatDisplayValue = (value?: string | null) => {
  if (!value) return "";
  return value.trim();
};

const useDebouncedValue = <T,>(value: T, delay = 200) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};

interface ProducerComboboxProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowCustomValue?: boolean;
  className?: string;
  onSuggestionSelected?: (suggestion: ProducerSuggestion | null) => void;
  countryFilter?: string | null;
  regionFilter?: string | null;
}

export default function ProducerCombobox({
  value,
  onChange,
  placeholder = "Weingut auswählen",
  disabled,
  allowCustomValue = true,
  className,
  onSuggestionSelected,
  countryFilter,
  regionFilter,
}: ProducerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);

  const { data, isFetching } = useQuery({
    queryKey: ["wine-producer-suggestions", debouncedSearch, countryFilter ?? "", regionFilter ?? ""],
    queryFn: async (): Promise<{ producers: ProducerSuggestion[] }> => {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) {
        params.set("q", debouncedSearch.trim());
      }
      if (countryFilter?.trim()) {
        params.set("country", countryFilter.trim());
      }
      if (regionFilter?.trim()) {
        params.set("region", regionFilter.trim());
      }
      const query = params.toString();
      const res = await apiRequest(
        "GET",
        `/api/wine-suggestions/producers${query ? `?${query}` : ""}`
      );
      const json = await res.json();
      return json;
    },
  });

  const options = useMemo(
    () =>
      (data?.producers ?? []).filter(
        (option): option is ProducerSuggestion & { name: string } =>
          typeof option?.name === "string" && option.name.trim().length > 0
      ),
    [data?.producers]
  );

  const hasExactMatch = useMemo(() => {
    const candidate = debouncedSearch.trim().toLowerCase();
    if (!candidate) return false;
    return options.some((option) => option.name.toLowerCase() === candidate);
  }, [options, debouncedSearch]);

  const handleSelect = (next: string, suggestion: ProducerSuggestion | null) => {
    onChange(next);
    onSuggestionSelected?.(suggestion);
    setSearch("");
    setOpen(false);
  };

  const displayValue = formatDisplayValue(value);

  return (
    <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn("w-full justify-between", className)}
        >
          <span className="truncate mr-2 text-left">
            {displayValue || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Weingut suchen..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isFetching && (
              <div className="flex items-center justify-center py-3 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Lädt Weingüter...
              </div>
            )}
            <CommandEmpty>
              Keine Weingüter gefunden.
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const optionLabel = option.name;
                const isSelected = displayValue.toLowerCase() === optionLabel.toLowerCase();
                return (
                  <CommandItem
                    key={optionLabel.toLowerCase()}
                    value={optionLabel}
                    onSelect={() => handleSelect(optionLabel, option)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1 truncate">{optionLabel}</span>
                  </CommandItem>
                );
              })}
              {allowCustomValue && search.trim() && !hasExactMatch && (
                <CommandItem
                  key="custom-producer"
                  value={search.trim()}
                  onSelect={() => handleSelect(search.trim(), null)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Eigenes Weingut verwenden: "{search.trim()}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
