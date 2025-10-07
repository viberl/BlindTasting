import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Wine, CalendarDays, ExternalLink, Plane, NotebookPen, Heart, Star } from 'lucide-react';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '@/hooks/use-auth';
import { useFavoriteWines, makeFavoriteKey } from '@/hooks/use-favorite-wines';

interface WineInfo {
  id: number;
  name: string;
  letterCode?: string | null;
  producer?: string | null;
  country?: string | null;
  region?: string | null;
  vintage?: string | null;
  varietals?: string[];
  vinaturelId?: string | null;
  vinaturelProductUrl?: string | null;
  vinaturelExternalId?: string | null;
  vinaturelArticleNumber?: string | null;
  imageUrl?: string | null;
}

interface TastingInfo {
  id: number;
  name: string;
  status?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
  hostName?: string | null;
  hostCompany?: string | null;
}

interface FlightInfo {
  id: number;
  name?: string | null;
  orderIndex?: number | null;
}

interface WineEntry {
  guessId: number | null;
  score: number | null;
  rating: number | null;
  notes: string | null;
  submittedAt: string | null;
  wine: WineInfo;
  tasting: TastingInfo;
  flight: FlightInfo | null;
}

const normalizeVinaturelUrl = (raw?: string | null) => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://www.vinaturel.de/${trimmed.replace(/^\/+/, '')}`;
};

const resolveVinaturelUrl = (wine: WineInfo, label?: string) => {
  const directUrl = normalizeVinaturelUrl(wine.vinaturelProductUrl);
  if (directUrl) return directUrl;

  const candidates = [
    wine.vinaturelArticleNumber,
    wine.vinaturelExternalId,
    wine.vinaturelId,
    label,
  ].map((value) => value?.trim()).filter((value): value is string => !!value);

  if (candidates.length === 0) return null;

  const query = candidates[0];
  return `https://www.vinaturel.de/search?search=${encodeURIComponent(query)}`;
};

const resolveWineImageUrl = (wine: WineInfo) => {
  const candidate = wine.imageUrl?.trim();
  if (candidate) {
    if (candidate.includes('product-placeholder')) return candidate;
    if (candidate.startsWith('http://') || candidate.startsWith('https://')) return candidate;
    return `https://www.vinaturel.de/${candidate.replace(/^\/+/, '')}`;
  }
  return '/product-placeholder.png';
};

const formatDate = (date?: string | null) => {
  if (!date) return 'Datum unbekannt';
  try {
    return format(new Date(date), 'PPP', { locale: de });
  } catch {
    return 'Datum unbekannt';
  }
};

const WineCard = ({
  entry,
  onAction,
  actionLabel,
  isFavorite,
  onToggleFavorite,
  hidePointsWhenNull = false,
  hostedNote,
  onHostedNoteChange,
}: {
  entry: WineEntry;
  onAction?: () => void;
  actionLabel?: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  hidePointsWhenNull?: boolean;
  hostedNote?: string;
  onHostedNoteChange?: (value: string) => void;
}) => {
  const label = `${entry.wine.producer ?? ''} ${entry.wine.name ?? ''}`.trim() || entry.wine.name || 'Unbekannter Wein';
  const vinaturelUrl = resolveVinaturelUrl(entry.wine, label);
  const tastingDate = entry.tasting.completedAt || entry.tasting.createdAt || entry.submittedAt;
  const imageSrc = resolveWineImageUrl(entry.wine);
  const [isEditing, setIsEditing] = useState(false);
  const initialNotes = entry.notes ?? hostedNote ?? '';
  const [notesValue, setNotesValue] = useState(initialNotes);
  const queryClient = useQueryClient();
  const updateNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      if (!entry.guessId) return;
      await apiRequest('PATCH', `/api/users/me/wines/${entry.guessId}/notes`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/me/wines'] });
      setIsEditing(false);
    },
  });

  useEffect(() => {
    setNotesValue(entry.notes ?? hostedNote ?? '');
  }, [entry.notes, hostedNote]);

  const handleSaveNotes = () => {
    const trimmed = notesValue.trim();
    if (entry.guessId) {
      updateNotesMutation.mutate(trimmed);
    } else if (onHostedNoteChange) {
      onHostedNoteChange(trimmed);
      setIsEditing(false);
    }
  };

  const canEditNotes = Boolean(entry.guessId || onHostedNoteChange);

  const showPointsBadge = !(hidePointsWhenNull && (entry.score === null || entry.score === undefined));

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3 justify-between">
          <div className="h-20 w-14 flex items-center justify-center">
            <img
              src={imageSrc}
              alt={label}
              className="h-full w-full max-h-20 object-contain"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                if (!target.dataset.fallback) {
                  target.dataset.fallback = 'true';
                  target.src = '/product-placeholder.png';
                }
              }}
            />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold text-gray-900">
              {vinaturelUrl ? (
                <a href={vinaturelUrl} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1 text-[#274E37]">
                  <span>{label}</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : (
                <span>{label}</span>
              )}
            </CardTitle>
            <div className="text-sm text-gray-600">
              {entry.wine.region || entry.wine.country ? (
                <span>
                  {[entry.wine.region, entry.wine.country].filter(Boolean).join(', ')}
                  {entry.wine.vintage ? `, ${entry.wine.vintage}` : ''}
                </span>
              ) : (
                <span>Herkunft unbekannt</span>
              )}
            </div>
            {entry.wine.varietals && entry.wine.varietals.length > 0 && (
              <div className="flex flex-wrap gap-1 text-xs text-gray-500">
                {entry.wine.varietals.map((v) => (
                  <span key={v} className="px-2 py-0.5 bg-gray-100 rounded-full">{v}</span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onToggleFavorite}
            className={`h-8 w-8 flex items-center justify-center transition-colors ${
              isFavorite ? 'text-[#e65b2d]' : 'text-gray-300 hover:text-[#e65b2d]'
            }`}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? 'Favorit entfernen' : 'Als Favorit markieren'}
          >
            <Heart className={`h-5 w-5 ${isFavorite ? 'fill-[#e65b2d]' : 'fill-transparent'}`} />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-gray-700">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 text-gray-600">
            <Wine className="h-4 w-4" />
            <span>{entry.tasting.name}</span>
          </div>
          <div className="flex items-center gap-1 text-gray-600">
            <CalendarDays className="h-4 w-4" />
            <span>{formatDate(tastingDate)}</span>
          </div>
          {entry.flight?.name && (
            <div className="flex items-center gap-1 text-gray-600">
              <Plane className="h-4 w-4" />
              <span>{entry.flight.name}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {entry.rating !== null && entry.rating !== undefined && (
            <span className="text-xs text-gray-500">Bewertung: {entry.rating}/100</span>
          )}
          {showPointsBadge && (
            <Badge variant="secondary" className="bg-[#274E37]/10 text-[#274E37]">
              Punkte: {entry.score !== null ? entry.score : '–'}
            </Badge>
          )}
          {entry.submittedAt && (
            <span className="text-xs text-gray-400">
              Eingereicht am {formatDate(entry.submittedAt)}
            </span>
          )}
        </div>
        <div className="bg-gray-50 rounded-md p-3">
          <div className="flex items-center justify-between mb-2 gap-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">Notizen</p>
            {canEditNotes && !isEditing && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setIsEditing(true)}>
                Bearbeiten
              </Button>
            )}
          </div>
          {canEditNotes && isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                rows={4}
                placeholder="Notizen hinzufügen"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => {
                    setIsEditing(false);
                    setNotesValue(entry.notes ?? hostedNote ?? '');
                  }}
                  disabled={entry.guessId ? updateNotesMutation.isPending : false}
                >
                  Abbrechen
                </Button>
                <Button
                  size="sm"
                  className="h-8 px-3 bg-vinaturel-original hover:bg-vinaturel-highlight text-white"
                  onClick={handleSaveNotes}
                  disabled={entry.guessId ? updateNotesMutation.isPending : false}
                >
                  Speichern
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {(entry.notes ?? hostedNote)?.trim().length
                ? (entry.notes ?? hostedNote)
                : 'Keine Notizen hinterlegt.'}
            </p>
          )}
        </div>
        {onAction && actionLabel && (
          <div className="pt-2">
            <Button onClick={onAction} className="bg-vinaturel-original hover:bg-vinaturel-highlight text-white" size="sm">
              {actionLabel}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function MyWinesPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { toggleFavorite, isFavorite } = useFavoriteWines();

  const HOSTED_NOTES_STORAGE_KEY = 'my-wines-hosted-notes';

  const readHostedNotes = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(HOSTED_NOTES_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const entries: Record<string, string> = {};
        Object.entries(parsed).forEach(([key, value]) => {
          if (typeof value === 'string') entries[key] = value;
        });
        return entries;
      }
    } catch {
      // ignore
    }
    return {};
  };

  const [hostedNotes, setHostedNotes] = useState<Record<string, string>>(() => readHostedNotes());

  const updateHostedNotesStorage = (notes: Record<string, string>) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(HOSTED_NOTES_STORAGE_KEY, JSON.stringify(notes));
    } catch {
      // ignore
    }
  };

  const setHostedNoteForKey = (key: string, value: string) => {
    setHostedNotes(prev => {
      const next = { ...prev };
      if (value && value.trim().length > 0) {
        next[key] = value;
      } else {
        delete next[key];
      }
      updateHostedNotesStorage(next);
      return next;
    });
  };
  const { data, isLoading } = useQuery<{ tasted: WineEntry[]; hosted: WineEntry[] }>({
    queryKey: ['/api/users/me/wines'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/users/me/wines');
      if (!res.ok) throw new Error('Fehler beim Laden der Weine');
      return res.json();
    },
    enabled: !!user,
  });

  const tasted = data?.tasted ?? [];
  const hosted = data?.hosted ?? [];
  const allEntries = useMemo(() => [...tasted, ...hosted], [tasted, hosted]);
  const favoriteEntries = useMemo(() => {
    const seen = new Set<string>();
    const result: WineEntry[] = [];
    allEntries.forEach(entry => {
      const key = makeFavoriteKey(entry.tasting.id, entry.wine.id);
      if (!seen.has(key) && isFavorite(key)) {
        seen.add(key);
        result.push(entry);
      }
    });
    return result;
  }, [allEntries, isFavorite]);

  if (!user) {
    return <div className="container mx-auto py-6 px-4">Bitte melden Sie sich an, um Ihre Weine zu sehen.</div>;
  }

  if (isLoading) {
    return <div className="container mx-auto py-6 px-4">Lade Weine…</div>;
  }

  const renderList = (
    entries: WineEntry[],
    emptyLabel: string,
    action?: (entry: WineEntry) => void,
    actionLabel?: string,
    options?: { hidePointsWhenNull?: boolean }
  ) => {
    if (!entries.length) {
      return <div className="text-gray-500">{emptyLabel}</div>;
    }
    const hidePoints = options?.hidePointsWhenNull ?? false;
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {entries.map((entry) => {
          const favoriteKey = makeFavoriteKey(entry.tasting.id, entry.wine.id);
          const reactKey = entry.guessId ? `guess-${entry.guessId}` : `hosted-${favoriteKey}`;
          const hostedNote = hostedNotes[favoriteKey];
          const hideForEntry = hidePoints || entry.guessId === null || entry.guessId === undefined;
          return (
            <WineCard
              key={reactKey}
              entry={entry}
              onAction={action ? () => action(entry) : undefined}
              actionLabel={actionLabel}
              isFavorite={isFavorite(favoriteKey)}
              onToggleFavorite={() => toggleFavorite(favoriteKey)}
              hidePointsWhenNull={hideForEntry}
              hostedNote={entry.guessId ? undefined : hostedNote}
              onHostedNoteChange={entry.guessId ? undefined : (value) => setHostedNoteForKey(favoriteKey, value)}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <h1 className="text-2xl font-bold mb-4">Meine Weine</h1>
      <Tabs defaultValue={favoriteEntries.length ? 'favorites' : 'tasted'} className="space-y-6">
        <div className="max-w-2xl rounded-2xl p-[1px] bg-[#e65b2d]">
          <div className="rounded-2xl bg-vinaturel-light">
            <TabsList className="!grid w-full grid-cols-3 min-h-[60px] pb-3 rounded-2xl overflow-visible outline-none bg-transparent" style={{ minHeight: '42px', paddingBottom: '8px' }}>
              <TabsTrigger
                value="favorites"
                className="flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-vinaturel-original data-[state=active]:font-medium rounded-md py-2 px-3 transition-colors text-vinaturel-original"
              >
                <Star className="h-4 w-4" />
                <span className="truncate">Favoriten</span>
                {favoriteEntries.length > 0 && (
                  <span className="ml-1 min-w-[20px] h-5 flex items-center justify-center px-1.5 py-0.5 rounded-full bg-vinaturel-original text-white text-xs font-medium">
                    {favoriteEntries.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="tasted"
                className="flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-vinaturel-original data-[state=active]:font-medium rounded-md py-2 px-3 transition-colors text-vinaturel-original"
              >
                <Wine className="h-4 w-4" />
                <span className="truncate">Verkostete Weine</span>
                {tasted.length > 0 && (
                  <span className="ml-1 min-w-[20px] h-5 flex items-center justify-center px-1.5 py-0.5 rounded-full bg-vinaturel-original text-white text-xs font-medium">
                    {tasted.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="hosted"
                className="flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-vinaturel-original data-[state=active]:font-medium rounded-md py-2 px-3 transition-colors text-vinaturel-original"
              >
                <NotebookPen className="h-4 w-4" />
                <span className="truncate">Gehostete Weine</span>
                {hosted.length > 0 && (
                  <span className="ml-1 min-w-[20px] h-5 flex items-center justify-center px-1.5 py-0.5 rounded-full bg-vinaturel-original text-white text-xs font-medium">
                    {hosted.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
        <TabsContent value="favorites">
          {renderList(favoriteEntries, 'Noch keine Favoriten markiert.', (entry) => {
            if (entry.guessId) {
              navigate(`/tasting/${entry.tasting.id}/results`);
            }
          }, 'Ergebnisse ansehen')}
        </TabsContent>
        <TabsContent value="tasted">
          {renderList(tasted, 'Noch keine verkosteten Weine gefunden.', (entry) => {
            if (entry.guessId) {
              navigate(`/tasting/${entry.tasting.id}/results`);
            }
          }, 'Ergebnisse ansehen')}
        </TabsContent>
        <TabsContent value="hosted">
          {renderList(hosted, 'Noch keine gehosteten Weine vorhanden.', (entry) => {
            navigate(`/host/tasting/${entry.tasting.id}`);
          }, 'Verkostung öffnen')}
        </TabsContent>
      </Tabs>
    </div>
  );
}
