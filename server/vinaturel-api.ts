import axios from 'axios';

interface VinaturelCredentials {
  username: string;
  password: string;
  apiKey: string;
}

interface VinaturelToken {
  token: string;
  expiresAt: Date;
}

interface VinaturelWine {
  id: string;
  name: string;
  producer: string;
  country: string;
  region: string;
  vintage: string | number;
  varietals: string[];
  price: number;
  imageUrl?: string;
  description?: string;
}

let cachedToken: VinaturelToken | null = null;

async function authenticate(credentials: VinaturelCredentials): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && cachedToken.expiresAt > new Date()) {
    return cachedToken.token;
  }

  try {
    console.log('Authenticating with Vinaturel API using credentials:', {
      username: credentials.username,
      apiKey: credentials.apiKey ? `${credentials.apiKey.substring(0, 5)}...` : 'not set'
    });
    
    const response = await axios.post('https://vinaturel.de/store-api/auth', {
      identifier: credentials.username,
      password: credentials.password
    }, {
      headers: {
        'Content-Type': 'application/json',
        'sw-access-key': credentials.apiKey,
        'sw-context-token': credentials.apiKey,
        'Accept': 'application/json'
      }
    });

    console.log('Authentication response status:', response.status);
    console.log('Authentication response data:', JSON.stringify(response.data, null, 2));

    // Calculate token expiration (assuming token expires in 1 hour)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Cache the token
    cachedToken = {
      token: response.data.access_token,
      expiresAt
    };

    return response.data.access_token;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Error authenticating with Vinaturel API:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
    } else {
      console.error('Error authenticating with Vinaturel API:', error);
    }
    throw new Error('Failed to authenticate with Vinaturel API');
  }
}

async function fetchWines(credentials: VinaturelCredentials, limit = 50, page = 1): Promise<VinaturelWine[]> {
  try {
    const token = await authenticate(credentials);
    
    console.log('Fetching wines with token', token ? `${token.substring(0, 10)}...` : 'not available');
    
    const response = await axios.post('https://vinaturel.de/store-api/product', {
      limit,
      page,
      filter: [
        {
          type: "equals",
          field: "active",
          value: "1"
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'sw-access-key': credentials.apiKey
      }
    });
    
    console.log('Wine search response status:', response.status);
    console.log('Wine search response data structure:', {
      total: response.data.total,
      elementCount: response.data.elements?.length || 0
    });

    // Transform the response into our VinaturelWine format
    return response.data.elements.map((item: any) => {
      // Extract grape varieties from product attributes or properties
      const varietals = extractVarietals(item);
      
      return {
        id: item.id,
        name: item.name || '',
        producer: extractProducer(item),
        country: extractCountry(item),
        region: extractRegion(item),
        vintage: extractVintage(item),
        varietals,
        price: item.price?.gross || 0,
        imageUrl: extractImageUrl(item),
        description: item.description || ''
      };
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Error fetching wines from Vinaturel API:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
    } else {
      console.error('Error fetching wines from Vinaturel API:', error);
    }
    throw new Error('Failed to fetch wines from Vinaturel API');
  }
}

// Helper functions to extract wine data from API response
function extractProducer(item: any): string {
  // Extract producer from manufacturer or custom fields
  return item.manufacturer?.name || '';
}

function extractCountry(item: any): string {
  // Extract country from custom properties or fields
  if (item.properties) {
    const countryProp = item.properties.find((prop: any) => 
      prop.group?.name?.toLowerCase().includes('land') || 
      prop.name?.toLowerCase().includes('land')
    );
    if (countryProp) {
      return countryProp.name || '';
    }
  }
  return '';
}

function extractRegion(item: any): string {
  // Extract region from custom properties or fields
  if (item.properties) {
    const regionProp = item.properties.find((prop: any) => 
      prop.group?.name?.toLowerCase().includes('region') || 
      prop.name?.toLowerCase().includes('region')
    );
    if (regionProp) {
      return regionProp.name || '';
    }
  }
  return '';
}

function extractVintage(item: any): string {
  // Extract vintage from custom properties or from the name
  if (item.properties) {
    const vintageProp = item.properties.find((prop: any) => 
      prop.group?.name?.toLowerCase().includes('jahrgang') || 
      prop.name?.toLowerCase().includes('jahrgang')
    );
    if (vintageProp) {
      return vintageProp.name || '';
    }
  }
  
  // Try to extract vintage from the name (assuming format like "Wine Name 2020")
  const vintageMatch = item.name?.match(/\b(19|20)\d{2}\b/);
  if (vintageMatch) {
    return vintageMatch[0];
  }
  
  return '';
}

function extractVarietals(item: any): string[] {
  // Extract grape varieties from custom properties
  const varietals: string[] = [];
  
  if (item.properties) {
    const grapeProps = item.properties.filter((prop: any) => 
      prop.group?.name?.toLowerCase().includes('rebsorte') || 
      prop.name?.toLowerCase().includes('rebsorte')
    );
    
    if (grapeProps.length > 0) {
      grapeProps.forEach((prop: any) => {
        if (prop.name) {
          varietals.push(prop.name);
        }
      });
    }
  }
  
  return varietals;
}

function extractImageUrl(item: any): string | undefined {
  // Extract the main image URL if available
  if (item.cover && item.cover.media && item.cover.media.url) {
    return item.cover.media.url;
  }
  
  // Check for media array
  if (item.media && item.media.length > 0 && item.media[0].url) {
    return item.media[0].url;
  }
  
  return undefined;
}

// Export the functions
export const VinaturelAPI = {
  authenticate,
  fetchWines
};