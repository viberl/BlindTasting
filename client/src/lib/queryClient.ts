import { QueryClient, QueryFunction } from "@tanstack/react-query";

import { API_BASE_URL } from '@/config';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  endpoint: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Stelle sicher, dass der Endpunkt mit einem Slash beginnt
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${normalizedEndpoint}`;
  
  console.log(`API-Anfrage: ${method} ${url} mit Daten:`, data);
  
  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: 'include',
    });
    
    // Debug-Info für wichtige API-Aufrufe
    if (endpoint === '/api/login' || endpoint === '/api/register' || 
        endpoint === '/api/user' || endpoint === '/api/tastings') {
      console.log(`Antwort von ${endpoint}:`, res.status, res.statusText);
      const headerInfo = Array.from(res.headers.entries())
        .filter(([key]) => ['set-cookie', 'content-type'].includes(key.toLowerCase()))
        .map(([key, value]) => `${key}: ${value}`);
      
      if (headerInfo.length > 0) {
        console.log('Antwort-Header:', headerInfo);
      }
    }

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error('Fehler bei der API-Anfrage:', error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn = <T>(options: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> => {
  const { on401: unauthorizedBehavior } = options;
  
  return async ({ queryKey }) => {
    const endpoint = queryKey[0] as string;
    const params = queryKey[1] as Record<string, unknown> | undefined;
    
    // Baue die URL mit Parametern
    const url = new URL(`${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    
    console.log(`Query für URL: ${url.toString()}`);
    
    const res = await fetch(url.toString(), {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Debug-Info für wichtige API-Aufrufe
    if (endpoint === '/api/user' || endpoint === '/api/tastings') {
      console.log(`Antwort auf GET ${endpoint}:`, res.status, res.statusText);
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      console.log(`401 für ${endpoint} - Gibt null zurück wie angefordert`);
      return null as T;
    }

    await throwIfResNotOk(res);
    
    // Wenn die Antwort leer ist (z.B. bei 204 No Content), geben wir null zurück
    if (res.status === 204) {
      return null as unknown as T;
    }
    
    return await res.json() as T;
  };
};

// Erstelle eine neue Instanz von QueryClient mit Standardoptionen
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Verwende eine Typ-assertion, um die Typen zu erzwingen
      queryFn: getQueryFn<unknown>({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
