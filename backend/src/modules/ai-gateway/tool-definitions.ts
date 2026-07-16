/** AI function/tool definitions for streaming chat. */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}


export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'search_hotels',
    description: 'Search for REAL hotel prices and availability. Use this to get live hotel data with actual prices from 200+ OTAs like Expedia, Booking.com, Hotels.com. Call this whenever the user asks about hotels, accommodation, or places to stay.',
    parameters: {
      type: 'object',
      properties: {
        destination: { type: 'string', description: 'City or destination name (e.g., "Paris", "New York", "Tokyo")' },
        checkin: { type: 'string', description: 'Check-in date in YYYY-MM-DD format' },
        checkout: { type: 'string', description: 'Check-out date in YYYY-MM-DD format' },
        adults: { type: 'number', description: 'Number of adults (default: 2)' },
        rooms: { type: 'number', description: 'Number of rooms (default: 1)' },
        cur: { type: 'string', description: 'Currency code like USD, INR, EUR (default: USD)' },
      },
      required: ['destination'],
    },
  },
  {
    name: 'search_places',
    description: 'Search for REAL attractions, restaurants, and points of interest near a location. Use this to get actual places, landmarks, and activities. Call this when the user asks about things to do, attractions, sightseeing, or food.',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City or location name' },
        categories: { type: 'string', description: 'Category filter (e.g., "tourism.attraction,tourism.sights,catering.restaurant,commercial.supermarket"). Default: tourism.attraction,tourism.sights,catering.restaurant' },
        limit: { type: 'number', description: 'Maximum results to return (default: 10)' },
      },
      required: ['location'],
    },
  },
  {
    name: 'search_web',
    description: 'Search the web for current information, travel guides, visa requirements, weather, events, or any other real-time data. Use this when you need up-to-date information the user is asking about.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query (e.g., "visa requirements for US citizens visiting France 2026")' },
        location: { type: 'string', description: 'Optional location context (e.g., "US", "IN", "GB")' },
        language: { type: 'string', description: 'Optional language code (e.g., "en", "fr", "es")' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_flights',
    description: 'Search for REAL flight data including schedules, routes, and status. Use this when the user asks about flights, air travel, or airline routes.',
    parameters: {
      type: 'object',
      properties: {
        flight_date: { type: 'string', description: 'Optional flight date in YYYY-MM-DD format. If omitted, returns current/recent flights.' },
      },
    },
  },
  {
    name: 'search_airports',
    description: 'Search for REAL airport data worldwide. Use this to get airport codes, names, and locations for any country.',
    parameters: {
      type: 'object',
      properties: {
        country: { type: 'string', description: 'Country name to filter airports (e.g., "India", "USA", "France")' },
      },
    },
  },
  {
    name: 'show_itinerary',
    description: 'Display a day-by-day travel itinerary to the user. Call this when you have enough information to suggest a trip plan.',
    parameters: {
      type: 'object',
      properties: {
        destination: { type: 'string', description: 'Travel destination' },
        nights: { type: 'number', description: 'Number of nights' },
        days: { type: 'number', description: 'Number of days' },
        travelers: { type: 'number', description: 'Number of travelers' },
        estimated_budget: { type: 'number', description: 'Estimated total budget per person in INR' },
        trip_type: { type: 'array', items: { type: 'string' }, description: 'Trip style tags e.g. ["adventure", "relaxation"]' },
        highlights: { type: 'array', items: { type: 'string' }, description: 'Top 3-5 trip highlights' },
        days_plan: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              day_number: { type: 'number' },
              title: { type: 'string' },
              description: { type: 'string' },
              activities: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    duration_hours: { type: 'number' },
                    category: { type: 'string' },
                  },
                  required: ['name', 'description'],
                },
              },
            },
            required: ['day_number', 'title', 'description'],
          },
          description: 'Day-by-day itinerary plan',
        },
      },
      required: ['destination', 'nights', 'days', 'travelers', 'estimated_budget', 'trip_type', 'highlights', 'days_plan'],
    },
  },
  {
    name: 'show_budget_breakdown',
    description: 'Display a detailed cost breakdown for the trip. Call this when the user asks about costs, budget, or pricing.',
    parameters: {
      type: 'object',
      properties: {
        destination: { type: 'string' },
        currency: { type: 'string', description: 'Currency code e.g. INR' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string', description: 'e.g. Flights, Hotels, Activities, Transfers, Meals' },
              amount: { type: 'number' },
              note: { type: 'string', description: 'Optional note about this cost' },
            },
            required: ['category', 'amount'],
          },
        },
        total_per_person: { type: 'number' },
        total_trip: { type: 'number' },
        travelers: { type: 'number' },
      },
      required: ['destination', 'currency', 'items', 'total_per_person', 'travelers'],
    },
  },
  {
    name: 'show_hotel_options',
    description: 'Display hotel comparison options. Call this when the user asks about hotels or accommodation.',
    parameters: {
      type: 'object',
      properties: {
        destination: { type: 'string' },
        options: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              category: { type: 'string', description: 'e.g. Budget, Mid-Range, Luxury' },
              price_per_night: { type: 'number' },
              currency: { type: 'string' },
              rating: { type: 'number', description: 'Star rating 1-5' },
              highlights: { type: 'array', items: { type: 'string' } },
              location: { type: 'string' },
            },
            required: ['name', 'category', 'price_per_night', 'currency', 'rating', 'highlights'],
          },
        },
      },
      required: ['destination', 'options'],
    },
  },
  {
    name: 'show_activity_options',
    description: 'Display activity/experience options for the user to choose from. Call this when the user asks about things to do or activities.',
    parameters: {
      type: 'object',
      properties: {
        destination: { type: 'string' },
        activities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              duration: { type: 'string', description: 'e.g. "3 hours", "Full day"' },
              price: { type: 'number' },
              currency: { type: 'string' },
              category: { type: 'string', description: 'e.g. Adventure, Cultural, Relaxation' },
              difficulty: { type: 'string', description: 'e.g. Easy, Moderate, Challenging' },
            },
            required: ['name', 'description', 'duration', 'price', 'currency', 'category'],
          },
        },
      },
      required: ['destination', 'activities'],
    },
  },
  {
    name: 'create_package',
    description: 'Create a travel package in the system when the user confirms they want to book. Only call this when the user explicitly wants to proceed with booking. The system will execute this and return a package_id.',
    parameters: {
      type: 'object',
      properties: {
        destination: { type: 'string' },
        nights: { type: 'number' },
        people: { type: 'number' },
      },
      required: ['destination', 'nights', 'people'],
    },
  },
  {
    name: 'generate_quote',
    description: 'Generate a price quote for an existing package. Call this after create_package succeeds and the user wants to see the final price. Requires a package_id from a previously created package.',
    parameters: {
      type: 'object',
      properties: {
        package_id: { type: 'string', description: 'The package ID returned from create_package' },
      },
      required: ['package_id'],
    },
  },
  {
    name: 'start_checkout',
    description: 'Start the payment checkout process for a quote. Call this after generate_quote when the user wants to pay. Requires a quote_id from a previously generated quote.',
    parameters: {
      type: 'object',
      properties: {
        quote_id: { type: 'string', description: 'The quote ID returned from generate_quote' },
      },
      required: ['quote_id'],
    },
  },
  {
    name: 'show_comparison',
    description: 'Display a side-by-side comparison of destinations or options. Call this when the user wants to compare places or options.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Comparison title' },
        options: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              pros: { type: 'array', items: { type: 'string' } },
              cons: { type: 'array', items: { type: 'string' } },
              budget: { type: 'string' },
              best_for: { type: 'string' },
              weather: { type: 'string' },
            },
            required: ['name', 'pros', 'cons', 'budget', 'best_for'],
          },
        },
      },
      required: ['title', 'options'],
    },
  },
  {
    name: 'show_visa_info',
    description: 'Display visa requirements and entry information for a destination. Call this when the user asks about visa requirements, travel documents, or entry rules for a country.',
    parameters: {
      type: 'object',
      properties: {
        destination: { type: 'string', description: 'Destination country name' },
        passport_country: { type: 'string', description: 'User passport country (e.g., India, USA). Ask the user if not provided.' },
        visa_status: { type: 'string', description: 'Visa status: visa_free, visa_on_arrival, eta_required, evisa_available, visa_required' },
        visa_type: { type: 'string', description: 'Type of visa required (e.g., Tourist, Schengen, e-Visa)' },
        max_stay_days: { type: 'number', description: 'Maximum allowed stay in days' },
        notes: { type: 'string', description: 'Important notes about the visa' },
        official_source_url: { type: 'string', description: 'URL to official visa application portal' },
        recommendations: { type: 'array', items: { type: 'string' }, description: 'Actionable steps for the user' },
        documents: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              document_type: { type: 'string' },
              is_required: { type: 'boolean' },
              description: { type: 'string' },
            },
            required: ['document_type', 'is_required'],
          },
          description: 'Required documents for visa application',
        },
      },
      required: ['destination', 'passport_country', 'visa_status'],
    },
  },
];
