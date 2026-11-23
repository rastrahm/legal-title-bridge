/**
 * Curated ISO 3166-1 numeric country codes for the verifier form (lab UI).
 */

export interface IsoCountry {
  code: number;
  nameEs: string;
  nameEn: string;
}

/** Small list covering common lab / demo choices; Spain default (724). */
export const ISO_COUNTRIES: IsoCountry[] = [
  { code: 32, nameEs: "Argentina", nameEn: "Argentina" },
  { code: 76, nameEs: "Brasil", nameEn: "Brazil" },
  { code: 152, nameEs: "Chile", nameEn: "Chile" },
  { code: 170, nameEs: "Colombia", nameEn: "Colombia" },
  { code: 484, nameEs: "México", nameEn: "Mexico" },
  { code: 604, nameEs: "Perú", nameEn: "Peru" },
  { code: 724, nameEs: "España", nameEn: "Spain" },
  { code: 840, nameEs: "Estados Unidos", nameEn: "United States" },
  { code: 826, nameEs: "Reino Unido", nameEn: "United Kingdom" },
  { code: 250, nameEs: "Francia", nameEn: "France" },
  { code: 276, nameEs: "Alemania", nameEn: "Germany" },
];

export function countryLabel(
  c: IsoCountry,
  locale: "es" | "en",
): string {
  return locale === "es" ? c.nameEs : c.nameEn;
}
