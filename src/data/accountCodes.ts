export interface AccountCode {
  code: string;
  name: string;
  site: string;
}

// Source: Circle Express account code list (add more rows here from your Excel)
export const ACCOUNT_CODES: AccountCode[] = [
  { code: 'L196701', name: '1967 SPUD RELOADING SUPPLIES LTD', site: 'Circle Express Ltd Heathrow' },
  { code: 'L1ST02',  name: '1ST GALAXY FIREWORKS LTD',         site: 'Circle Express Ltd Heathrow' },
  { code: 'L1ST01',  name: '1ST PENGUIN SHIPPING',              site: 'Circle Express Ltd Heathrow' },
  { code: 'L3RD01',  name: '3RD LIGHT LTD (ENOLAGAYE)',         site: 'Circle Express Ltd Heathrow' },
  { code: 'LLOG03',  name: '4 POINT WORLDWIDE LTD',             site: 'Circle Express Ltd Heathrow' },
  { code: 'L6AL01',  name: '6 Alpha Associates Ltd',            site: 'Circle Express Ltd Heathrow' },
  { code: 'LAHA01',  name: 'A HARTRODT UK LTD',                 site: 'Circle Express Ltd Heathrow' },
  { code: 'LAJW02',  name: 'A JA WALTER AVIATION',              site: 'Circle Express Ltd Heathrow' },
  { code: 'LA&O01',  name: 'A&O IT SVCS',                       site: 'Circle Express Ltd Heathrow' },
  { code: 'LA2S01',  name: 'A-2-SEA SOLUTIONS LIMITED',         site: 'Circle Express Ltd Heathrow' },
  { code: 'LA4LO01', name: 'A4 LOGISTICS',                      site: 'Circle Express Ltd Heathrow' },
  { code: 'LAAI01',  name: 'AAI GLOBAL LTD (MANCHESTER)',        site: 'Circle Express Ltd Heathrow' },
  // ── Add more rows below. Format: { code: '...', name: '...', site: '...' }, ──
];
