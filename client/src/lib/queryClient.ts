import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  console.log(`API-Anfrage: ${method} ${url} mit Credentials`, data);
  
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  
  // Debug-Info für wichtige API-Aufrufe
  if (url === '/api/login' || url === '/api/register' || url === '/api/user' || url === '/api/tastings') {
    console.log(`Antwort von ${url}:`, res.status, res.statusText);
    const headerInfo = Array.from(res.headers.entries())
      .filter(([key]) => ['set-cookie', 'content-type'].includes(key.toLowerCase()))
      .map(([key, value]) => `${key}: ${value}`);
    
    if (headerInfo.length > 0) {
      console.log('Antwort-Header:', headerInfo);
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    console.log(`Query für URL: ${url}`);
    
    const res = await fetch(url, {
      credentials: "include",
    });
    
    // Debug-Info für wichtige API-Aufrufe
    if (url === '/api/user' || url === '/api/tastings') {
      console.log(`Antwort auf GET ${url}:`, res.status, res.statusText);
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      console.log(`401 für ${url} - Gibt null zurück wie angefordert`);
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
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
