const PINNED_COUNTRY_NAMES = [
  "United States",
  "Canada",
  "United Kingdom",
  "India",
  "Mexico",
] as const;

const OTHER_COUNTRY_NAMES =
  "Afghanistan|Åland Islands|Albania|Algeria|American Samoa|Andorra|Angola|Anguilla|Antarctica|Antigua & Barbuda|Argentina|Armenia|Aruba|Australia|Austria|Azerbaijan|Bahamas|Bahrain|Bangladesh|Barbados|Belarus|Belgium|Belize|Benin|Bermuda|Bhutan|Bolivia|Bosnia & Herzegovina|Botswana|Bouvet Island|Brazil|British Indian Ocean Territory|British Virgin Islands|Brunei|Bulgaria|Burkina Faso|Burundi|Cambodia|Cameroon|Cape Verde|Caribbean Netherlands|Cayman Islands|Central African Republic|Chad|Chile|China|Christmas Island|Cocos (Keeling) Islands|Colombia|Comoros|Congo - Brazzaville|Congo - Kinshasa|Cook Islands|Costa Rica|Côte d’Ivoire|Croatia|Cuba|Curaçao|Cyprus|Czechia|Denmark|Djibouti|Dominica|Dominican Republic|Ecuador|Egypt|El Salvador|Equatorial Guinea|Eritrea|Estonia|Eswatini|Ethiopia|Falkland Islands|Faroe Islands|Fiji|Finland|France|French Guiana|French Polynesia|French Southern Territories|Gabon|Gambia|Georgia|Germany|Ghana|Gibraltar|Greece|Greenland|Grenada|Guadeloupe|Guam|Guatemala|Guernsey|Guinea|Guinea-Bissau|Guyana|Haiti|Heard & McDonald Islands|Honduras|Hong Kong SAR China|Hungary|Iceland|Indonesia|Iran|Iraq|Ireland|Isle of Man|Israel|Italy|Jamaica|Japan|Jersey|Jordan|Kazakhstan|Kenya|Kiribati|Kuwait|Kyrgyzstan|Laos|Latvia|Lebanon|Lesotho|Liberia|Libya|Liechtenstein|Lithuania|Luxembourg|Macao SAR China|Madagascar|Malawi|Malaysia|Maldives|Mali|Malta|Marshall Islands|Martinique|Mauritania|Mauritius|Mayotte|Micronesia|Moldova|Monaco|Mongolia|Montenegro|Montserrat|Morocco|Mozambique|Myanmar (Burma)|Namibia|Nauru|Nepal|Netherlands|New Caledonia|New Zealand|Nicaragua|Niger|Nigeria|Niue|Norfolk Island|North Korea|North Macedonia|Northern Mariana Islands|Norway|Oman|Pakistan|Palau|Palestinian Territories|Panama|Papua New Guinea|Paraguay|Peru|Philippines|Pitcairn Islands|Poland|Portugal|Puerto Rico|Qatar|Réunion|Romania|Russia|Rwanda|Samoa|San Marino|São Tomé & Príncipe|Saudi Arabia|Senegal|Serbia|Seychelles|Sierra Leone|Singapore|Sint Maarten|Slovakia|Slovenia|Solomon Islands|Somalia|South Africa|South Georgia & South Sandwich Islands|South Korea|South Sudan|Spain|Sri Lanka|St. Barthélemy|St. Helena|St. Kitts & Nevis|St. Lucia|St. Martin|St. Pierre & Miquelon|St. Vincent & Grenadines|Sudan|Suriname|Svalbard & Jan Mayen|Sweden|Switzerland|Syria|Taiwan|Tajikistan|Tanzania|Thailand|Timor-Leste|Togo|Tokelau|Tonga|Trinidad & Tobago|Tunisia|Türkiye|Turkmenistan|Turks & Caicos Islands|Tuvalu|U.S. Outlying Islands|U.S. Virgin Islands|Uganda|Ukraine|United Arab Emirates|Uruguay|Uzbekistan|Vanuatu|Vatican City|Venezuela|Vietnam|Wallis & Futuna|Western Sahara|Yemen|Zambia|Zimbabwe".split(
    "|",
  );

type RegionTuple = readonly [name: string, code: string];

const US_STATE_TUPLES = [
  ["Alabama", "AL"],
  ["Alaska", "AK"],
  ["American Samoa", "AS"],
  ["Arizona", "AZ"],
  ["Arkansas", "AR"],
  ["California", "CA"],
  ["Colorado", "CO"],
  ["Connecticut", "CT"],
  ["Delaware", "DE"],
  ["District of Columbia", "DC"],
  ["Florida", "FL"],
  ["Georgia", "GA"],
  ["Guam", "GU"],
  ["Hawaii", "HI"],
  ["Idaho", "ID"],
  ["Illinois", "IL"],
  ["Indiana", "IN"],
  ["Iowa", "IA"],
  ["Kansas", "KS"],
  ["Kentucky", "KY"],
  ["Louisiana", "LA"],
  ["Maine", "ME"],
  ["Maryland", "MD"],
  ["Massachusetts", "MA"],
  ["Michigan", "MI"],
  ["Minnesota", "MN"],
  ["Mississippi", "MS"],
  ["Missouri", "MO"],
  ["Montana", "MT"],
  ["Nebraska", "NE"],
  ["Nevada", "NV"],
  ["New Hampshire", "NH"],
  ["New Jersey", "NJ"],
  ["New Mexico", "NM"],
  ["New York", "NY"],
  ["North Carolina", "NC"],
  ["North Dakota", "ND"],
  ["Northern Mariana Islands", "MP"],
  ["Ohio", "OH"],
  ["Oklahoma", "OK"],
  ["Oregon", "OR"],
  ["Pennsylvania", "PA"],
  ["Puerto Rico", "PR"],
  ["Rhode Island", "RI"],
  ["South Carolina", "SC"],
  ["South Dakota", "SD"],
  ["Tennessee", "TN"],
  ["Texas", "TX"],
  ["Utah", "UT"],
  ["Vermont", "VT"],
  ["U.S. Virgin Islands", "VI"],
  ["Virginia", "VA"],
  ["Washington", "WA"],
  ["West Virginia", "WV"],
  ["Wisconsin", "WI"],
  ["Wyoming", "WY"],
] as const satisfies readonly RegionTuple[];

const CANADA_PROVINCE_TUPLES = [
  ["Alberta", "AB"],
  ["British Columbia", "BC"],
  ["Manitoba", "MB"],
  ["New Brunswick", "NB"],
  ["Newfoundland and Labrador", "NL"],
  ["Northwest Territories", "NT"],
  ["Nova Scotia", "NS"],
  ["Nunavut", "NU"],
  ["Ontario", "ON"],
  ["Prince Edward Island", "PE"],
  ["Quebec", "QC"],
  ["Saskatchewan", "SK"],
  ["Yukon", "YT"],
] as const satisfies readonly RegionTuple[];

const toOption = ([name]: RegionTuple) => ({ value: name, label: name });
const normalized = (value: string) => value.trim().toLowerCase();
const namesAndCodes = (tuples: readonly RegionTuple[]) =>
  new Set(
    tuples.flatMap(([name, code]) => [normalized(name), normalized(code)]),
  );

export const COUNTRY_OPTIONS = [
  ...PINNED_COUNTRY_NAMES,
  ...OTHER_COUNTRY_NAMES,
].map((name) => ({ value: name, label: name }));

const COUNTRY_NAMES = new Set(COUNTRY_OPTIONS.map(({ value }) => value));

export const US_STATE_OPTIONS = US_STATE_TUPLES.map(toOption);
export const CANADA_PROVINCE_OPTIONS = CANADA_PROVINCE_TUPLES.map(toOption);

const US_STATE_NAMES_OR_CODES = namesAndCodes(US_STATE_TUPLES);
const CANADA_PROVINCE_NAMES_OR_CODES = namesAndCodes(CANADA_PROVINCE_TUPLES);

export function isKnownCountry(value: string): boolean {
  return COUNTRY_NAMES.has(value.trim());
}

export function isKnownUsState(value: string): boolean {
  return US_STATE_NAMES_OR_CODES.has(normalized(value));
}

export function isKnownCanadianProvince(value: string): boolean {
  return CANADA_PROVINCE_NAMES_OR_CODES.has(normalized(value));
}

export function isValidPostalCodeForCountry({
  country,
  postalCode,
}: {
  country: string;
  postalCode: string;
}): boolean {
  const value = postalCode.trim();
  if (country === "United States") return /^\d{5}(-\d{4})?$/.test(value);
  if (country === "Canada") {
    return /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i.test(
      value,
    );
  }
  return true;
}
