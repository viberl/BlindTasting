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

export interface WineSuggestion {
  name: string;
  vinaturel: boolean;
  custom: boolean;
  vinaturelCount?: number;
  customCount?: number;
  country?: string | null;
  region?: string | null;
}

const useDebouncedValue = <T,>(value: T, delay = 200) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};

interface WineNameComboboxProps {
  producer?: string | null;
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowCustomValue?: boolean;
  className?: string;
  onSuggestionSelected?: (suggestion: WineSuggestion | null) => void;
  countryFilter?: string | null;
  regionFilter?: string | null;
}

export default function WineNameCombobox({
  producer,
  value,
  onChange,
  placeholder = "Wein auswählen",
  disabled,
  allowCustomValue = true,
  className,
  onSuggestionSelected,
  countryFilter,
  regionFilter,
}: WineNameComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);
  const normalizedProducer = producer?.trim();

  const { data, isFetching } = useQuery({
    queryKey: [
      "wine-name-suggestions",
      normalizedProducer?.toLowerCase() ?? "",
      debouncedSearch,
      countryFilter ?? "",
      regionFilter ?? "",
    ],
    queryFn: async (): Promise<{ wines: WineSuggestion[] }> => {
      if (!normalizedProducer) {
        return { wines: [] };
      }
      const params = new URLSearchParams({ producer: normalizedProducer });
      if (debouncedSearch.trim()) {
        params.set("q", debouncedSearch.trim());
      }
      if (countryFilter?.trim()) {
        params.set("country", countryFilter.trim());
      }
      if (regionFilter?.trim()) {
        params.set("region", regionFilter.trim());
      }
      const res = await apiRequest("GET", `/api/wine-suggestions/names?${params.toString()}`);
      const json = await res.json();
      return json;
    },
    enabled: !!normalizedProducer,
  });

  const options = useMemo(
    () =>
      (data?.wines ?? []).filter(
        (option): option is WineSuggestion & { name: string } =>
          typeof option?.name === "string" && option.name.trim().length > 0
      ),
    [data?.wines]
  );

  const hasExactMatch = useMemo(() => {
    const candidate = debouncedSearch.trim().toLowerCase();
    if (!candidate) return false;
    return options.some((option) => option.name.toLowerCase() === candidate);
  }, [options, debouncedSearch]);

  const handleSelect = (next: string, suggestion: WineSuggestion | null) => {
    onChange(next);
    onSuggestionSelected?.(suggestion);
    setSearch("");
    setOpen(false);
  };

  const displayValue = value?.trim() ?? "";

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
            value={search}
            onValueChange={setSearch}
            placeholder={normalizedProducer ? "Wein suchen..." : "Bitte zuerst ein Weingut wählen"}
            disabled={!normalizedProducer}
          />
          <CommandList>
            {isFetching && normalizedProducer && (
              <div className="flex items-center justify-center py-3 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Lädt Weine...
              </div>
            )}
            <CommandEmpty>
              {normalizedProducer ? 'Keine Weine gefunden.' : 'Bitte zuerst ein Weingut auswählen.'}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const optionLabel = option.name;
                const isSelected = displayValue.toLowerCase() === optionLabel.toLowerCase();
                return (
                  <CommandItem
                    key={`${normalizedProducer}-${optionLabel.toLowerCase()}`}
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
              {allowCustomValue && search.trim() && !hasExactMatch && normalizedProducer && (
                <CommandItem
                  key="custom-wine"
                  value={search.trim()}
                  onSelect={() => handleSelect(search.trim(), null)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Eigenen Wein eintragen: "{search.trim()}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
