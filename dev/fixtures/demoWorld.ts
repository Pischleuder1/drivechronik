export type DemoPlaceType =
  | "home"
  | "work"
  | "customer"
  | "site"
  | "supplier"
  | "hotel"
  | "charger"
  | "parking"
  | "other";

export interface DemoPlace {
  key: string;
  name: string;
  type: DemoPlaceType;

  lat: number;
  lon: number;
  radiusM: number;

  displayName: string;
  road: string | null;
  houseNumber: string | null;
  city: string;
  postcode: string;
  state: string;
  country: string;

  electricityPricePerKwh: number | null;
}

export const DEMO_PLACES: DemoPlace[] = [
  {
    key: "home",
    name: "Zuhause",
    type: "home",
    lat: 52.0302,
    lon: 8.5325,
    radiusM: 140,
    displayName: "Musterweg 12, 33602 Bielefeld, Deutschland",
    road: "Musterweg",
    houseNumber: "12",
    city: "Bielefeld",
    postcode: "33602",
    state: "Nordrhein-Westfalen",
    country: "Deutschland",
    electricityPricePerKwh: 0.32,
  },
  {
    key: "office",
    name: "Büro",
    type: "work",
    lat: 52.1157,
    lon: 8.6762,
    radiusM: 180,
    displayName: "Bürozentrum, 32052 Herford, Deutschland",
    road: null,
    houseNumber: null,
    city: "Herford",
    postcode: "32052",
    state: "Nordrhein-Westfalen",
    country: "Deutschland",
    electricityPricePerKwh: 0.29,
  },

  {
    key: "customer-hannover",
    name: "Kunde Nord GmbH",
    type: "customer",
    lat: 52.3759,
    lon: 9.7320,
    radiusM: 220,
    displayName: "Industriegebiet, 30159 Hannover, Deutschland",
    road: null,
    houseNumber: null,
    city: "Hannover",
    postcode: "30159",
    state: "Niedersachsen",
    country: "Deutschland",
    electricityPricePerKwh: null,
  },
  {
    key: "customer-muenster",
    name: "Kunde West GmbH",
    type: "customer",
    lat: 51.9607,
    lon: 7.6261,
    radiusM: 220,
    displayName: "Gewerbegebiet, 48143 Münster, Deutschland",
    road: null,
    houseNumber: null,
    city: "Münster",
    postcode: "48143",
    state: "Nordrhein-Westfalen",
    country: "Deutschland",
    electricityPricePerKwh: null,
  },
  {
    key: "customer-osnabrueck",
    name: "Kunde Osnabrück",
    type: "customer",
    lat: 52.2799,
    lon: 8.0472,
    radiusM: 220,
    displayName: "Gewerbegebiet, 49074 Osnabrück, Deutschland",
    road: null,
    houseNumber: null,
    city: "Osnabrück",
    postcode: "49074",
    state: "Niedersachsen",
    country: "Deutschland",
    electricityPricePerKwh: null,
  },
  {
    key: "customer-dortmund",
    name: "Kunde Ruhrgebiet GmbH",
    type: "customer",
    lat: 51.5136,
    lon: 7.4653,
    radiusM: 220,
    displayName: "Industriegebiet, 44135 Dortmund, Deutschland",
    road: null,
    houseNumber: null,
    city: "Dortmund",
    postcode: "44135",
    state: "Nordrhein-Westfalen",
    country: "Deutschland",
    electricityPricePerKwh: null,
  },
  {
    key: "customer-kassel",
    name: "Kunde Mitte GmbH",
    type: "customer",
    lat: 51.3127,
    lon: 9.4797,
    radiusM: 220,
    displayName: "Gewerbegebiet, 34117 Kassel, Deutschland",
    road: null,
    houseNumber: null,
    city: "Kassel",
    postcode: "34117",
    state: "Hessen",
    country: "Deutschland",
    electricityPricePerKwh: null,
  },
  {
    key: "customer-paderborn",
    name: "Kunde Paderborn",
    type: "customer",
    lat: 51.7189,
    lon: 8.7575,
    radiusM: 220,
    displayName: "Gewerbegebiet, 33098 Paderborn, Deutschland",
    road: null,
    houseNumber: null,
    city: "Paderborn",
    postcode: "33098",
    state: "Nordrhein-Westfalen",
    country: "Deutschland",
    electricityPricePerKwh: null,
  },

  {
    key: "site-guetersloh",
    name: "Baustelle Projekt Nord",
    type: "site",
    lat: 51.9069,
    lon: 8.3785,
    radiusM: 250,
    displayName: "Projektstandort, 33330 Gütersloh, Deutschland",
    road: null,
    houseNumber: null,
    city: "Gütersloh",
    postcode: "33330",
    state: "Nordrhein-Westfalen",
    country: "Deutschland",
    electricityPricePerKwh: null,
  },
  {
    key: "supplier-minden",
    name: "Lieferant Demo Baustoffe",
    type: "supplier",
    lat: 52.2895,
    lon: 8.9146,
    radiusM: 220,
    displayName: "Gewerbegebiet, 32423 Minden, Deutschland",
    road: null,
    houseNumber: null,
    city: "Minden",
    postcode: "32423",
    state: "Nordrhein-Westfalen",
    country: "Deutschland",
    electricityPricePerKwh: null,
  },

  {
    key: "hotel-hannover",
    name: "Business Hotel Hannover",
    type: "hotel",
    lat: 52.3745,
    lon: 9.7620,
    radiusM: 180,
    displayName: "Demo Hotel, 30161 Hannover, Deutschland",
    road: null,
    houseNumber: null,
    city: "Hannover",
    postcode: "30161",
    state: "Niedersachsen",
    country: "Deutschland",
    electricityPricePerKwh: 0.49,
  },
  {
    key: "hotel-hamburg",
    name: "Ferienhotel Hamburg",
    type: "hotel",
    lat: 53.5511,
    lon: 9.9937,
    radiusM: 200,
    displayName: "Demo Hotel, 20095 Hamburg, Deutschland",
    road: null,
    houseNumber: null,
    city: "Hamburg",
    postcode: "20095",
    state: "Hamburg",
    country: "Deutschland",
    electricityPricePerKwh: 0.49,
  },

  {
    key: "charger-porta",
    name: "Schnelllader Porta",
    type: "charger",
    lat: 52.2400,
    lon: 8.9200,
    radiusM: 260,
    displayName: "Demo Schnelllader, Porta Westfalica, Deutschland",
    road: null,
    houseNumber: null,
    city: "Porta Westfalica",
    postcode: "32457",
    state: "Nordrhein-Westfalen",
    country: "Deutschland",
    electricityPricePerKwh: 0.59,
  },
  {
    key: "charger-lauenau",
    name: "Schnelllader Lauenau",
    type: "charger",
    lat: 52.2730,
    lon: 9.3730,
    radiusM: 260,
    displayName: "Demo Schnelllader, Lauenau, Deutschland",
    road: null,
    houseNumber: null,
    city: "Lauenau",
    postcode: "31867",
    state: "Niedersachsen",
    country: "Deutschland",
    electricityPricePerKwh: 0.59,
  },
  {
    key: "charger-bispingen",
    name: "Schnelllader Bispingen",
    type: "charger",
    lat: 53.0830,
    lon: 9.9980,
    radiusM: 260,
    displayName: "Demo Schnelllader, Bispingen, Deutschland",
    road: null,
    houseNumber: null,
    city: "Bispingen",
    postcode: "29646",
    state: "Niedersachsen",
    country: "Deutschland",
    electricityPricePerKwh: 0.59,
  },

  {
    key: "supermarket",
    name: "Supermarkt",
    type: "other",
    lat: 52.0223,
    lon: 8.5410,
    radiusM: 140,
    displayName: "Supermarkt, Bielefeld, Deutschland",
    road: null,
    houseNumber: null,
    city: "Bielefeld",
    postcode: "33602",
    state: "Nordrhein-Westfalen",
    country: "Deutschland",
    electricityPricePerKwh: null,
  },
  {
    key: "leisure-detmold",
    name: "Freizeitziel Detmold",
    type: "other",
    lat: 51.9363,
    lon: 8.8792,
    radiusM: 180,
    displayName: "Freizeitziel, Detmold, Deutschland",
    road: null,
    houseNumber: null,
    city: "Detmold",
    postcode: "32756",
    state: "Nordrhein-Westfalen",
    country: "Deutschland",
    electricityPricePerKwh: null,
  },
  {
    key: "parking-bielefeld",
    name: "Parkhaus Innenstadt",
    type: "parking",
    lat: 52.0254,
    lon: 8.5357,
    radiusM: 100,
    displayName: "Innenstadt, Bielefeld, Deutschland",
    road: null,
    houseNumber: null,
    city: "Bielefeld",
    postcode: "33602",
    state: "Nordrhein-Westfalen",
    country: "Deutschland",
    electricityPricePerKwh: null,
  },
];

export const DEMO_PLACE_BY_KEY = new Map(
  DEMO_PLACES.map((place) => [place.key, place]),
);

export const BUSINESS_PLACE_KEYS = [
  "customer-hannover",
  "customer-muenster",
  "customer-osnabrueck",
  "customer-dortmund",
  "customer-kassel",
  "customer-paderborn",
  "site-guetersloh",
  "supplier-minden",
  "hotel-hannover",
] as const;

export const PRIVATE_PLACE_KEYS = [
  "supermarket",
  "leisure-detmold",
  "hotel-hamburg",
  "charger-porta",
  "charger-lauenau",
  "charger-bispingen",
] as const;

export const CUSTOMER_PLACE_KEYS = [
  "customer-hannover",
  "customer-muenster",
  "customer-osnabrueck",
  "customer-dortmund",
  "customer-kassel",
  "customer-paderborn",
] as const;

export function demoPlace(key: string): DemoPlace {
  const place = DEMO_PLACE_BY_KEY.get(key);

  if (!place) {
    throw new Error(`Unknown demo place: ${key}`);
  }

  return place;
}
