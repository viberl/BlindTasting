import { countryToRegions } from "@/data/country-regions";

export const normalizeKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const COUNTRY_LOOKUP = new Map<string, string>(
  Object.keys(countryToRegions).map((country) => [normalizeKey(country), country])
);

const COUNTRY_SYNONYMS: Record<string, string> = {
  france: 'Frankreich',
  french: 'Frankreich',
  italien: 'Italien',
  italy: 'Italien',
  italia: 'Italien',
  espana: 'Spanien',
  spain: 'Spanien',
  deutschland: 'Deutschland',
  germany: 'Deutschland',
  austria: 'Österreich',
  austrian: 'Österreich',
  suisse: 'Schweiz',
  switzerland: 'Schweiz',
  suisseromande: 'Schweiz',
  portugal: 'Portugal',
  portogallo: 'Portugal',
  greece: 'Griechenland',
  grecia: 'Griechenland',
  usa: 'USA',
  unitedstates: 'USA',
  unitedstatesofamerica: 'USA',
  chile: 'Chile',
  argentinia: 'Argentinien',
  argentina: 'Argentinien',
  australia: 'Australien',
  newzealand: 'Neuseeland',
  newzealanders: 'Neuseeland',
  southafrica: 'Südafrika',
};

interface RegionAliasConfig {
  country: string;
  canonical: string;
  aliases: string[];
}

const REGION_ALIAS_CONFIG: RegionAliasConfig[] = [
  {
    country: 'Frankreich',
    canonical: 'Elsass',
    aliases: ['alsace', 'alsacegrandcru', "cremantdalsace", 'alsaceaoc'],
  },
  {
    country: 'Frankreich',
    canonical: 'Provence',
    aliases: ['bandol', 'cotesdeprovence', 'palette', 'cassis', 'bellet'],
  },
  {
    country: 'Frankreich',
    canonical: 'Rhône (Nord & Süd)',
    aliases: [
      'cotesdurhone',
      'cotedurhone',
      'chateauneufdupape',
      'gigondas',
      'vacqueyras',
      'hermitage',
      'stjoseph',
      'saintjoseph',
      'crozeshermitage',
      'cornas',
      'coterotie',
      'beaumesdevenise',
      'tavel',
      'ventoux',
    ],
  },
  {
    country: 'Frankreich',
    canonical: 'Bordeaux',
    aliases: [
      'medoc',
      'hautmedoc',
      'pauillac',
      'margaux',
      'saintjulien',
      'saintestephe',
      'pomerol',
      'saintemilion',
      'fronsac',
      'entredeuxmers',
      'graves',
      'sauternes',
      'pessacleognan',
    ],
  },
  {
    country: 'Frankreich',
    canonical: 'Burgund',
    aliases: [
      'bourgogne',
      'cotedor',
      'cotesdebeaune',
      'cotedenuits',
      'beaujolais',
      'maconnais',
      'macon',
      'chablis',
      'gevreychambertin',
      'nuitsstgeorges',
      'vosneromanee',
    ],
  },
  {
    country: 'Frankreich',
    canonical: 'Loire',
    aliases: ['sancerre', 'pouillyfume', 'vouvray', 'chinon', 'muscadet', 'bourgueil', 'anjou', 'saumur'],
  },
  {
    country: 'Frankreich',
    canonical: 'Languedoc-Roussillon',
    aliases: ['languedoc', 'picstloup', 'minervois', 'fitou', 'corbieres', 'faugeres', 'limoux'],
  },
  {
    country: 'Frankreich',
    canonical: 'Sud-Ouest',
    aliases: ['cahors', 'madiran', 'gaillac', 'jurancon', 'bergerac', 'pecharment'],
  },
  {
    country: 'Frankreich',
    canonical: 'Champagne',
    aliases: ['champagne', 'montagne', 'cotedesblancs', 'valleedelamarne'],
  },
  {
    country: 'Italien',
    canonical: 'Piemont',
    aliases: ['piemonte', 'barolo', 'barbaresco', 'langhe', 'gattinara', 'roero'],
  },
  {
    country: 'Italien',
    canonical: 'Toskana',
    aliases: ['chianti', 'chianticlassico', 'brunellodimontalcino', 'bolgheri', 'maremma', 'carmignano'],
  },
  {
    country: 'Italien',
    canonical: 'Venetien',
    aliases: ['valpolicella', 'amarone', 'soave', 'bardolino', 'lugana', 'veneto'],
  },
  {
    country: 'Italien',
    canonical: 'Emilia-Romagna',
    aliases: ['emiliaromagna', 'emilia', 'romagna', 'lambrusco'],
  },
  {
    country: 'Italien',
    canonical: 'Friaul',
    aliases: ['friuli', 'friuliveneziagiulia'],
  },
  {
    country: 'Italien',
    canonical: 'Lombardei',
    aliases: ['lombardia', 'franciacorta'],
  },
  {
    country: 'Italien',
    canonical: 'Sizilien',
    aliases: ['sicilia', 'etna', 'sicily'],
  },
  {
    country: 'Italien',
    canonical: 'Abruzzen',
    aliases: ['abruzzo', 'collineabruzzesi', 'collecorviano'],
  },
  {
    country: 'Italien',
    canonical: 'Südtirol',
    aliases: ['altoadige', 'sudtirol'],
  },
  {
    country: 'Italien',
    canonical: 'Trentin',
    aliases: ['trentino', 'trento', 'dolomiti'],
  },
  {
    country: 'Italien',
    canonical: 'Apulien',
    aliases: ['salento', 'primitivodimanduria', 'puglia'],
  },
  {
    country: 'Spanien',
    canonical: 'Rioja',
    aliases: ['rioja', 'riojaalavesa', 'riojaalta', 'riojabaja'],
  },
  {
    country: 'Spanien',
    canonical: 'Ribera del Duero',
    aliases: ['riberadelduero', 'ribera'],
  },
  {
    country: 'Spanien',
    canonical: 'Priorat',
    aliases: ['priorat', 'priorato', 'prioratdoca'],
  },
  {
    country: 'Spanien',
    canonical: 'Navarra',
    aliases: ['navarra', 'navarre'],
  },
  {
    country: 'Spanien',
    canonical: 'Penedès',
    aliases: ['penedes', 'penedescava'],
  },
  {
    country: 'Spanien',
    canonical: 'Rías Baixas',
    aliases: ['riasbaixas', 'rias baixas', 'valedorosalnes'],
  },
  {
    country: 'Spanien',
    canonical: 'Toro',
    aliases: ['toro', 'zamora'],
  },
  {
    country: 'Spanien',
    canonical: 'Bierzo',
    aliases: ['bierzo', 'elbierzo'],
  },
  {
    country: 'Portugal',
    canonical: 'Douro',
    aliases: ['douro', 'portodouro'],
  },
  {
    country: 'Portugal',
    canonical: 'Vinho Verde',
    aliases: ['vinhoverde', 'minho'],
  },
  {
    country: 'Deutschland',
    canonical: 'Mosel',
    aliases: ['mosel', 'moseltal'],
  },
  {
    country: 'Deutschland',
    canonical: 'Rheingau',
    aliases: ['rheingau'],
  },
  {
    country: 'Deutschland',
    canonical: 'Rheinhessen',
    aliases: ['rheinhessen'],
  },
  {
    country: 'Österreich',
    canonical: 'Burgenland',
    aliases: [
      'burgenland',
      'mittelburgenland',
      'neusiedlersee',
      'burgenlandneusiedlersee',
      'neusiedlerseehugelland',
      'neusiedlersee-hugelland',
      'seewinkel',
      'gols',
      'illmitz',
      'leithaberg',
    ],
  },
  {
    country: 'Österreich',
    canonical: 'Niederösterreich',
    aliases: ['kamptal', 'kremstal', 'wachau', 'wagram', 'weinviertel', 'traisental'],
  },
  {
    country: 'Österreich',
    canonical: 'Steiermark',
    aliases: ['sudsteiermark', 'südsteiermark', 'vulkanland', 'vulkanlandsteiermark', 'weststeiermark'],
  },
  {
    country: 'USA',
    canonical: 'Kalifornien (Napa Valley, Sonoma, Central Coast, Central Valley)',
    aliases: ['napavalley', 'napa', 'sonoma', 'centralcoast', 'centralvalley', 'california'],
  },
  {
    country: 'USA',
    canonical: 'Oregon (Willamette Valley)',
    aliases: ['willamette', 'willamettevalley', 'oregon'],
  },
  {
    country: 'USA',
    canonical: 'Washington State (Columbia Valley, Walla Walla)',
    aliases: ['washington', 'wallawalla', 'columbiavalley'],
  },
  {
    country: 'Australien',
    canonical: 'Barossa Valley',
    aliases: ['barossa', 'barossavalley', 'southaustralia'],
  },
  {
    country: 'Australien',
    canonical: 'Margaret River',
    aliases: ['margaretriver', 'westernaustralia'],
  },
  {
    country: 'Australien',
    canonical: 'McLaren Vale',
    aliases: ['mclarenvale'],
  },
  {
    country: 'Australien',
    canonical: 'Yarra Valley',
    aliases: ['yarravalley'],
  },
  {
    country: 'Neuseeland',
    canonical: 'Hawke’s Bay',
    aliases: ['hawkesbay'],
  },
  {
    country: 'Neuseeland',
    canonical: 'Martinborough/Wairarapa',
    aliases: ['martinborough', 'wairarapa'],
  },
  {
    country: 'Neuseeland',
    canonical: 'Marlborough',
    aliases: ['marlborough'],
  },
  {
    country: 'Neuseeland',
    canonical: 'Central Otago',
    aliases: ['centralotago'],
  },
  {
    country: 'Neuseeland',
    canonical: 'Gisborne',
    aliases: ['gisborne'],
  },
];

const REGION_LOOKUP_BY_COUNTRY = new Map<string, Map<string, string>>(
  Object.entries(countryToRegions).map(([country, regions]) => [
    normalizeKey(country),
    new Map(regions.map((region) => [normalizeKey(region), region])),
  ])
);

for (const alias of REGION_ALIAS_CONFIG) {
  const countryKey = normalizeKey(alias.country);
  const lookup = REGION_LOOKUP_BY_COUNTRY.get(countryKey) ?? new Map<string, string>();
  lookup.set(normalizeKey(alias.canonical), alias.canonical);
  for (const variant of alias.aliases) {
    lookup.set(normalizeKey(variant), alias.canonical);
  }
  REGION_LOOKUP_BY_COUNTRY.set(countryKey, lookup);
}

export const canonicalizeCountry = (input?: string | null): string | null => {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const normalized = normalizeKey(trimmed);
  if (COUNTRY_LOOKUP.has(normalized)) {
    return COUNTRY_LOOKUP.get(normalized)!;
  }
  if (COUNTRY_SYNONYMS[normalized]) {
    return COUNTRY_SYNONYMS[normalized];
  }
  return trimmed;
};

export const canonicalizeRegion = (
  input?: string | null,
  country?: string | null
): string | null => {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const canonicalCountry = country ? canonicalizeCountry(country) : null;

  const attemptMatch = (raw: string): string | null => {
    const normalized = normalizeKey(raw);
    if (!normalized) return null;

    if (canonicalCountry) {
      const lookup = REGION_LOOKUP_BY_COUNTRY.get(normalizeKey(canonicalCountry));
      if (lookup) {
        if (lookup.has(normalized)) {
          return lookup.get(normalized)!;
        }
        for (const [key, regionName] of lookup.entries()) {
          if (normalized.includes(key) || key.includes(normalized)) {
            return regionName;
          }
        }
      }
    }

    for (const alias of REGION_ALIAS_CONFIG) {
      const matchesCountry = !alias.country || alias.country === canonicalCountry;
      if (matchesCountry && alias.aliases.some((keyword) => normalized.includes(keyword))) {
        return alias.canonical;
      }
    }

    return null;
  };

  const directMatch = attemptMatch(trimmed);
  if (directMatch) return directMatch;

  const parts = trimmed.split(/[\/,;\|]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    for (const part of parts) {
      const match = attemptMatch(part);
      if (match) return match;
    }
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    for (const word of words) {
      const match = attemptMatch(word);
      if (match) return match;
    }
  }

  return canonicalCountry ? attemptMatch(`${canonicalCountry} ${trimmed}`) ?? trimmed : trimmed;
};

export const getRegionsForCountry = (country?: string | null): string[] => {
  const canonical = canonicalizeCountry(country);
  if (!canonical) return [];
  const lookup = REGION_LOOKUP_BY_COUNTRY.get(normalizeKey(canonical));
  if (!lookup) return countryToRegions[canonical] || [];
  return Array.from(new Set([...(countryToRegions[canonical] || []), ...lookup.values()]));
};
