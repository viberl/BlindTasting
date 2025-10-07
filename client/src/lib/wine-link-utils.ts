export type LinkableWine = {
  isCustom?: boolean | string | number | null;
  vinaturelProductUrl?: string | null;
  vinaturelId?: string | null;
  vinaturelArticleNumber?: string | null;
  vinaturelExternalId?: string | null;
};

const hasMeaningfulValue = (raw?: unknown | null) => {
  if (raw === null || raw === undefined) return false;
  const trimmed = String(raw).trim();
  if (!trimmed) return false;
  const normalized = trimmed.toLowerCase();
  return !['null', 'undefined', 'n/a', 'na', 'kein', 'none', '0'].includes(normalized);
};

const normalizeVinaturelUrl = (raw?: string | null) => {
  if (!hasMeaningfulValue(raw)) return null;
  const trimmed = String(raw).trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://www.vinaturel.de/${trimmed.replace(/^\/+/, '')}`;
};

export const isCustomWine = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', 't', '1', 'yes', 'y'].includes(normalized);
  }
  return false;
};

const computeWineLink = (wine: LinkableWine, fallbackQuery?: string) => {
  if (isCustomWine(wine.isCustom)) return null;

  const direct = normalizeVinaturelUrl(wine.vinaturelProductUrl);
  if (direct) return direct;

  const candidates = [
    wine.vinaturelArticleNumber,
    wine.vinaturelExternalId,
    wine.vinaturelId,
    fallbackQuery,
  ].filter(hasMeaningfulValue).map((value) => String(value).trim());

  if (candidates.length === 0) return null;
  return `https://www.vinaturel.de/search?search=${encodeURIComponent(candidates[0])}`;
};

export const getWineLink = (wine: LinkableWine, fallbackQuery?: string) =>
  computeWineLink(wine, fallbackQuery);

export const shouldRenderWineLink = (wine: LinkableWine, fallbackQuery?: string) =>
  Boolean(getWineLink(wine, fallbackQuery));
