export const RESOURCE_MAP = {
  'Fossil Fuels': '("fossil fuels" OR "crude oil" OR oil OR gas OR coal OR "natural gas")',
  Oil:            '("crude oil" OR petroleum OR "oil production" OR "oil spill" OR "oil pipeline")',
  LNG:            '("natural gas" OR fracking OR "hydraulic fracturing" OR "liquefied natural gas")',
  Coal:           'coal', Mining: 'mining',
  Gold:      'gold AND (mining OR mine OR production OR exploration OR mineral OR ore)',
  Silver:    'silver AND (mining OR mine OR production OR exploration OR mineral OR ore)',
  Iron:      'iron AND ("iron ore" OR ore OR mining OR mine OR production OR exploration)',
  Copper:    'copper AND (mining OR mine OR production OR exploration OR mineral OR ore)',
  Nickel:    'nickel AND (mining OR mine OR production OR exploration OR mineral OR ore)',
  Cobalt:    'cobalt AND (mining OR mine OR production OR exploration OR mineral OR ore)',
  Zinc:      'zinc AND (mining OR mine OR production OR exploration OR mineral OR ore)',
  Lead:      'lead AND (mining OR mine OR production OR exploration OR mineral OR ore)',
  Platinum:  'platinum AND (mining OR mine OR production OR exploration OR mineral OR ore)',
  Palladium: 'palladium AND (mining OR mine OR production OR exploration OR mineral OR ore)',
  Lithium:   'lithium AND (mining OR mine OR production OR exploration OR mineral OR ore)',
  Graphite:  'graphite AND (mining OR mine OR production OR exploration OR mineral OR ore)',
  Tin:       'tin AND (mining OR mine OR production OR exploration OR mineral OR ore)',
  Tantalum: 'tantalum', Tungsten: 'tungsten', Manganese: 'manganese',
  Uranium: 'uranium', Antimony: 'antimony',
  'Critical Minerals': '(lithium OR cobalt OR nickel OR copper OR graphite OR manganese OR "rare earths" OR platinum OR palladium OR antimony)',
  ETMs:            '(lithium OR cobalt OR nickel OR copper OR graphite OR manganese OR "rare earths" OR platinum OR palladium OR antimony)',
  'Aluminum/Bauxite': '(aluminum OR bauxite) AND (mining OR mine OR production OR exploration)',
  'Palm Oil':  '("palm oil" OR "oil palm" OR "palm plantation")',
  Soy:         '(soy OR soybean OR "soy production")',
  'Cattle/Beef': '(cattle OR beef)',
  Logging:     '((logging OR timber) AND forest)',
  Biofuels:    'biofuels',
};

const REGION_MAP = {
  Africa: 'Africa', Asia: 'Asia', Europe: 'Europe',
  'Latin America': '(Brazil OR Argentina OR Chile OR Peru OR Colombia OR Mexico OR Venezuela OR Ecuador OR Bolivia OR Paraguay OR Uruguay)',
  Amazon:          '(Brazil OR Peru OR Colombia OR Bolivia OR Venezuela OR Ecuador OR Guyana OR Suriname OR "French Guiana")',
  'Middle East':   '("Middle East" OR Saudi Arabia OR Iran OR Iraq OR UAE OR Kuwait OR Qatar OR Oman OR Yemen OR Jordan OR Syria OR Lebanon)',
  'North America': '("North America" OR "United States" OR Canada OR Mexico)',
  Pacific:         '(Australia OR "New Zealand" OR Indonesia OR Philippines OR Papua)',
};

export function buildQuery({ resource = '', region = '', country = '' } = {}) {
  resource = resource.trim(); region = region.trim(); country = country.trim();
  const parts = [];
  const rKey = Object.keys(RESOURCE_MAP).find(k => k.toLowerCase() === resource.toLowerCase());
  const rTerm = rKey ? RESOURCE_MAP[rKey] : resource;
  if (rTerm) parts.push(rTerm);
  let loc = '';
  if (country) {
    const q = !country.startsWith('"') && (country.includes(' ') || country.includes('-')) ? `"${country}"` : country;
    loc = q;
  } else if (region && region !== 'Global') {
    loc = REGION_MAP[region] || region;
  }
  if (loc) parts.push(loc);
  return parts.join(' AND ');
}

export function buildArtListUrl(query, timespan = '7d', maxrecords = 250) {
  return `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=${maxrecords}&timespan=${timespan}&format=json`;
}

export function timespanLabel(ts) {
  return { '1d': 'today', '7d': 'past 7 days', '30d': 'past 30 days', '1y': 'past year' }[ts] ?? ts;
}
