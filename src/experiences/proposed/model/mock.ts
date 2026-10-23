/**
 * Typed mock adapters for the future integrations. Nothing here calls a real provider: every answer
 * comes from the Prototype Controls (`Sim`). All values are synthetic. Provider names are neutral:
 * which provider backs each adapter is a pending decision.
 */
import { matchingActivity } from './activity';
import { normaliseIban } from './config';
import type { Certificate, CertificatesResult, CrRecord, IbanResult, NafathResult, Person, Sim } from './types';

/* ------------------------------------------------------------------ synthetic demo identities */

/** The demo SMS code accepted by the simulated OTP service. */
export const DEMO_SMS_CODE = '246810';

/** Built at runtime so no national-ID / mobile-shaped literal sits in the source. */
export const DEMO = {
  cr: '7000000101',
  nationalId: ['1', '000000', '201'].join(''),
  mobile: ['5', '0000', '0012'].join(''),
  otherMobile: ['5', '0000', '0099'].join('')
};

/** Synthetic Saudi-format IBAN with impossible check digits (00). */
export const demoIban = (bankCode: '80' | '10' | '20', tail: string) => ['SA', '00', bankCode, '000000', '12345678', tail.padStart(4, '0').slice(-4)].join('');

/* ------------------------------------------------------------------ CR data adapter (registry + activities + address) */

export function crAdapter(sim: Sim, declaredSub: string): CrRecord | null {
  if (sim.cr.result !== 'found') return null;
  return {
    legalName: 'Najd Roastery Trading Company (demo)',
    status: sim.cr.status,
    issuedMonthsAgo: sim.cr.issuedMonthsAgo,
    expiry: sim.cr.status === 'EXPIRED' ? '2026-08-31' : '2028-03-13',
    city: 'Riyadh',
    entity: sim.cr.entity,
    legalForm: sim.cr.entity === 'NON_SAUDI' ? 'Limited liability company (foreign ownership, demo)' : 'Limited liability company (demo)',
    nationalAddress: sim.cr.nationalAddress,
    activity: sim.cr.activity === 'auto' ? matchingActivity(declaredSub) : sim.cr.activity
  };
}

/* ------------------------------------------------------------------ associated parties adapter */

const PEOPLE: Person[] = [
  { id: 'p1', name: ['Mohammed', 'Abdullah', 'Saad', 'Al-Qahtani'], idMasked: '104••••217', kind: 'individual' },
  { id: 'p2', name: ['Nora', 'Khalid', 'Fahad', 'Al-Shammari'], idMasked: '108••••530', kind: 'individual' },
  { id: 'p3', name: ['Abdullah', 'Mohammed', 'Saad', 'Al-Qahtani'], idMasked: '106••••882', kind: 'individual' }
];
const COMPANY_PARTNER: Person = { id: 'c1', name: ['Najd', 'Holding', 'Group', 'Company'], idMasked: '700••••404', kind: 'company' };

/** Raw associated parties. Companies are included on purpose: only individuals can use Nafath. */
export function personsAdapter(result: 'one' | 'multiple' | 'none'): Person[] {
  if (result === 'none') return [COMPANY_PARTNER];
  if (result === 'one') return [PEOPLE[0], COMPANY_PARTNER];
  return [...PEOPLE, COMPANY_PARTNER];
}
export const eligiblePersons = (list: Person[]) => list.filter((p) => p.kind === 'individual');
/** "Mohammed ••• ••• Al-Qahtani": first and last visible, second and third masked. */
export const maskedName = (p: Person) => `${p.name[0]} ••• ••• ${p.name[3]}`;

/* ------------------------------------------------------------------ Nafath adapter */

export const NAFATH_NUMBERS = ['42', '17', '85', '63', '29'];
export function nafathAdapter(sim: Sim, requestIndex: number): NafathResult {
  const q = sim.nafath.length ? sim.nafath : ['verified' as NafathResult];
  return q[Math.min(Math.max(requestIndex, 0), q.length - 1)];
}

/* ------------------------------------------------------------------ freelance certificates adapter */

export function certificatesAdapter(result: Exclude<CertificatesResult, 'none' | 'unavailable'>, declaredSub: string): Certificate[] {
  const own = matchingActivity(declaredSub);
  const c1: Certificate = { id: 'fl1', number: 'FL-400000001', activityLabel: 'Declared activity (demo)', activity: own, status: 'active' };
  const c2: Certificate = { id: 'fl2', number: 'FL-400000002', activityLabel: 'Photographic activities (demo)', activity: 'ACT-7420', status: 'active' };
  const c3: Certificate = { id: 'fl3', number: 'FL-400000003', activityLabel: 'Coffee shops (demo)', activity: 'ACT-5630', status: 'active' };
  switch (result) {
    case 'one': return [c1];
    case 'multiple': return [c1, c2, { ...c3, id: 'fl3' }];
    case 'expired': return [{ ...c1, status: 'expired' }, c2];
    case 'duplicate': return [{ ...c1, issue: 'duplicate' }, c2];
    case 'inconsistent': return [{ ...c1, issue: 'inconsistent' }];
    // The only certificate's activity differs from the declared category and requires a CR.
    case 'mismatch': return [{ ...c3, id: 'fl1' }];
  }
}

/* ------------------------------------------------------------------ bank ownership adapter */

const BANKS: Record<string, string> = {
  '05': 'Alinma Bank', '10': 'Saudi National Bank', '15': 'Bank Albilad', '20': 'Riyad Bank', '30': 'Arab National Bank',
  '45': 'Saudi Awwal Bank', '55': 'Banque Saudi Fransi', '60': 'Bank AlJazira', '65': 'Saudi Investment Bank', '80': 'Al Rajhi Bank'
};
export const bankFromIban = (iban: string) => BANKS[normaliseIban(iban).slice(4, 6)] ?? 'Saudi bank';

export function ibanAdapter(sim: Sim, checkIndex: number): IbanResult {
  const q = sim.iban.length ? sim.iban : ['verified' as IbanResult];
  return q[Math.min(checkIndex, q.length - 1)];
}

/* ------------------------------------------------------------------ ids */

const pad = (n: number) => String(100000 + (Math.abs(n) % 900000)).padStart(6, '0');
export const newApplicationId = (seed: number) => `APP-${pad(seed)}`;
export const newQualificationId = (seed: number) => `KYB-${pad(seed * 7 + 13)}`;
export const newContinueToken = (seed: number) => `CL-${pad(seed * 31 + 5)}${pad(seed * 17 + 3).slice(0, 3)}`;
export const providerRef = (type: string, seed: number) => `SIM-${type}-${pad(seed).slice(-4)}`;
