/**
 * MASTER BOARD — editable source of the simple, visual screen-flow board (management view).
 *
 * Every box is a real Madfu Proposed screen: its `state` is built with the same transitions the
 * prototype runs and rendered with the same step components (MasterBoardCanvas.tsx). Arrows carry
 * only short labels; `check` pills mark automatic checks that have no screen of their own.
 *
 * Rows: 0 = shared start (KYB → Identify → OTP) and routing after the code; 1 = new registered
 * business; 2 = CR signer handoff (Phase 2 delegation dashed); 3 = new Freelancer.
 *
 * To edit the board: move a box (`col` / `row`), change a title or caption, or change an arrow's
 * points / label below. `npm run pdf` regenerates public/Madfu_Proposed_Simple_Master_Board.pdf.
 * The detailed logic (rules, providers, limits) lives in the Detailed Logic Board (boards.ts).
 */
import { DEMO_SMS_CODE } from './mock';
import { scenarioById } from './scenarios';
import {
  agreeAndSubmit, delegationResult, finishIbanCheck, loadCertificates, prefill, runBusinessVerification, sendToNafath, setDelegationType, setIban,
  setPresence, startIbanCheck, submitIdentify, verifyOtp, withSaved
} from './state';
import type { OutcomeKind, ProposedState, StepId } from './types';

/* ------------------------------------------------------------------ geometry (px on the PDF canvas) */

export const BOARD_GEOMETRY = {
  /** Box = title + screen thumbnail + caption. */
  boxW: 520,
  boxH: 760,
  /** Thumbnail window inside the box and the width the real screen is rendered at before scaling. */
  thumbW: 500,
  thumbH: 650,
  screenW: 680,
  colX: (c: number) => 60 + c * 700,
  rowY: [270, 1200, 2130, 3060] as const,
  width: 6240,
  height: 3900
};

const G = BOARD_GEOMETRY;

export type BoardTone = 'step' | 'not-eligible' | 'existing' | 'done' | 'lane' | 'signer' | 'phase2';

export interface BoardBox {
  id: string;
  col: number;
  row: 0 | 1 | 2 | 3;
  /** Short title above the screen. */
  title: string;
  /** One short line under the screen (a few words). */
  caption?: string;
  /** Lane boxes only: the small line above the title. */
  eyebrow?: string;
  tone: BoardTone;
  /** The screen shown (a `lane` box shows text only). */
  step?: StepId;
  outcome?: OutcomeKind;
  state?: () => ProposedState;
}

export interface Pt { x: number; y: number }
export interface BoardPill {
  text: string;
  at: Pt;
  /** 'label' = short arrow label (e.g. "New", "Live"); 'check' = automatic check with no screen. */
  kind: 'label' | 'check';
}
export interface BoardArrow {
  id: string;
  /** Orthogonal polyline, first point = start, last point = arrow head. */
  points: Pt[];
  pills?: BoardPill[];
  /** Phase 2 / future route. */
  dashed?: boolean;
}

/* ------------------------------------------------------------------ screens (real states) */

const sc = (id: string) => scenarioById(id)!.build();
const otp = (s: ProposedState) => verifyOtp(s, DEMO_SMS_CODE);
const fl = (step: StepId) => withSaved(prefill('FL_CERT', step));

export const BOARD_BOXES: BoardBox[] = [
  // Row 0 — shared start and routing after the code
  { id: 'kyb', col: 0, row: 0, tone: 'step', title: 'Know Your Business', caption: 'Five questions · eligibility checked internally', step: 'kyb', state: () => sc('kyb-cr-online') },
  { id: 'identify', col: 1, row: 0, tone: 'step', title: 'Identify', caption: 'CR or National ID + mobile', step: 'identify', state: () => sc('id-new-cr') },
  { id: 'otp', col: 2, row: 0, tone: 'step', title: 'OTP', caption: 'SMS code to verify the mobile', step: 'otp', state: () => submitIdentify(sc('id-new-cr')) },
  { id: 'not-eligible', col: 3, row: 0, tone: 'not-eligible', title: 'Application Submitted', caption: 'Not eligible · reason stays internal', step: 'outcome', outcome: 'RECEIVED', state: () => otp(submitIdentify(sc('id-unsupported-cr'))) },
  { id: 'resume-cr', col: 4, row: 0, tone: 'existing', title: 'Resume · CR', caption: 'First unfinished CR step', step: 'business', state: () => otp(submitIdentify(sc('id-incomplete'))) },
  { id: 'resume-fl', col: 5, row: 0, tone: 'existing', title: 'Resume · Freelancer', caption: 'First unfinished Freelancer step', step: 'nafath', state: () => otp(submitIdentify(sc('id-incomplete-fl'))) },
  { id: 'progress', col: 6, row: 0, tone: 'existing', title: 'Application Progress', caption: 'Submitted application · status only', step: 'status', state: () => otp(submitIdentify(sc('id-submitted'))) },
  { id: 'live', col: 7, row: 0, tone: 'existing', title: 'Active Account', caption: 'Popup · Log in button', step: 'login', state: () => otp(submitIdentify(sc('id-live'))) },

  // Row 1 — new eligible registered business
  { id: 'lane-cr', col: 0, row: 1, tone: 'lane', title: 'Registered Business', caption: 'Self-Onboarding' },
  { id: 'cr-verify', col: 1, row: 1, tone: 'step', title: 'CR Verification', caption: 'Registration retrieved · nothing to type', step: 'cr', state: () => runBusinessVerification(sc('cr-business')) },
  { id: 'cr-details', col: 2, row: 1, tone: 'step', title: 'Business Details', caption: 'Website / Google Maps link', step: 'business', state: () => sc('biz-cr-both') },
  { id: 'cr-offer', col: 3, row: 1, tone: 'step', title: 'Commercial Offer', caption: 'Standard commission → Continue', step: 'commercial', state: () => sc('com-standard') },
  { id: 'cr-review', col: 4, row: 1, tone: 'step', title: 'Review', caption: 'Verified details locked', step: 'review', state: () => sc('review') },
  { id: 'cr-authorize', col: 5, row: 1, tone: 'step', title: 'Authorization Choice', caption: 'Myself, or another signer', step: 'authorize', state: () => sc('auth-choice') },
  { id: 'cr-nafath', col: 6, row: 1, tone: 'step', title: 'Nafath', caption: 'Owner / manager verifies identity', step: 'nafath', state: () => sendToNafath(sc('mm-match')) },
  { id: 'cr-contract', col: 7, row: 1, tone: 'step', title: 'Contract', caption: 'Agree & Submit', step: 'contract', state: () => sc('contract') },
  { id: 'cr-submitted', col: 8, row: 1, tone: 'done', title: 'Submitted', caption: 'Then: Application Progress', step: 'outcome', outcome: 'SUBMITTED', state: () => agreeAndSubmit(sc('contract')) },

  // Row 2 — CR signer handoff
  { id: 'lane-signer', col: 0, row: 2, tone: 'lane', eyebrow: 'Registered business', title: 'Signer', caption: 'Another owner / manager signs' },
  { id: 'handoff', col: 1, row: 2, tone: 'signer', title: 'Waiting for Authorization', caption: 'Application frozen · status only', step: 'handoff', state: () => sc('handoff-active') },
  { id: 'signer-link', col: 2, row: 2, tone: 'signer', title: 'Secure Link', caption: 'Masked request · no OTP', step: 'signer', state: () => sc('signer-link') },
  { id: 'signer-nafath', col: 3, row: 2, tone: 'signer', title: 'Nafath', caption: 'Signer verifies identity', step: 'nafath', state: () => sc('signer-nafath') },
  { id: 'signer-review', col: 4, row: 2, tone: 'signer', title: 'Read-only Review', caption: 'Full application + frozen offer', step: 'review', state: () => sc('signer-review') },
  { id: 'signer-contract', col: 5, row: 2, tone: 'signer', title: 'Contract', caption: 'Agree & Sign', step: 'contract', state: () => sc('signer-contract') },
  { id: 'signer-submitted', col: 6, row: 2, tone: 'done', title: 'Submitted', caption: 'Signed by the signer', step: 'outcome', outcome: 'SUBMITTED', state: () => agreeAndSubmit(sc('signer-contract')) },
  { id: 'delegation', col: 7, row: 2, tone: 'phase2', title: 'Delegated Signer · Phase 2', caption: 'MOJ or document review first', step: 'delegation', state: () => delegationResult(setDelegationType(sc('delegation-demo'), 'COMPANY_DOC'), 'under_review') },

  // Row 3 — new eligible Freelancer with certificate
  { id: 'lane-fl', col: 0, row: 3, tone: 'lane', title: 'Freelancer', caption: 'Self-Onboarding' },
  { id: 'fl-certificate', col: 1, row: 3, tone: 'step', title: 'Certificate', caption: 'Choose the Freelancer Certificate', step: 'certificates', state: () => loadCertificates(sc('fl-certs-multi')) },
  { id: 'fl-nafath', col: 2, row: 3, tone: 'step', title: 'Nafath', caption: 'Identity verified in the Nafath app', step: 'nafath', state: () => sendToNafath(sc('fl-nafath')) },
  { id: 'fl-details', col: 3, row: 3, tone: 'step', title: 'Business Details + IBAN', caption: 'Website · IBAN linked to the certificate', step: 'business', state: () => finishIbanCheck(startIbanCheck(setIban(setPresence(sc('biz-fl'), { websiteUrl: 'studio.example.com' }), 'SA0080000000123456784821'))) },
  { id: 'fl-offer', col: 4, row: 3, tone: 'step', title: 'Commercial Offer', caption: 'Standard commission → Continue', step: 'commercial', state: () => fl('commercial') },
  { id: 'fl-review', col: 5, row: 3, tone: 'step', title: 'Review', caption: 'Verified details locked', step: 'review', state: () => sc('review-fl') },
  { id: 'fl-contract', col: 6, row: 3, tone: 'step', title: 'Contract', caption: 'Agree & Submit', step: 'contract', state: () => fl('contract') },
  { id: 'fl-submitted', col: 7, row: 3, tone: 'done', title: 'Submitted', caption: 'Then: Application Progress', step: 'outcome', outcome: 'SUBMITTED', state: () => agreeAndSubmit(fl('contract')) }
];

/* ------------------------------------------------------------------ anchors */

const box = (id: string) => BOARD_BOXES.find((b) => b.id === id)!;
const x0 = (id: string) => G.colX(box(id).col);
const y0 = (id: string) => G.rowY[box(id).row];
const cx = (id: string) => x0(id) + G.boxW / 2;
const cy = (id: string) => y0(id) + G.boxH / 2;
const left = (id: string): Pt => ({ x: x0(id), y: cy(id) });
const right = (id: string): Pt => ({ x: x0(id) + G.boxW, y: cy(id) });
const top = (id: string): Pt => ({ x: cx(id), y: y0(id) });
const bottom = (id: string): Pt => ({ x: cx(id), y: y0(id) + G.boxH });
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const label = (text: string, at: Pt): BoardPill => ({ text, at, kind: 'label' });
const check = (text: string, at: Pt): BoardPill => ({ text, at, kind: 'check' });

/** Straight arrow between neighbours on the same row. */
const across = (from: string, to: string, pill?: (at: Pt) => BoardPill): BoardArrow => {
  const a = right(from);
  const b = left(to);
  return { id: `${from}-${to}`, points: [a, b], pills: pill ? [pill(mid(a, b))] : [] };
};

/** The routing bus above row 0 (from the OTP to the existing-record screens). */
const BUS_Y = G.rowY[0] - 80;
/** The "New" line between row 0 and row 1. */
const NEW_Y = G.rowY[1] - 90;
/** The "Send to signer" line between row 1 and row 2. */
const SIGNER_Y = G.rowY[2] - 90;
/** The Phase 2 line between row 2 and row 3. */
const PHASE2_Y = G.rowY[3] - 85;
/** The vertical line in the gap left of column 1 (down to the Freelancer lane). */
const GAP_X = G.colX(1) - 90;
const BUS_X = cx('otp') + 80;

const drop = (to: string, text: string): BoardArrow => ({
  id: `otp-${to}`,
  points: [{ x: BUS_X, y: y0('otp') }, { x: BUS_X, y: BUS_Y }, { x: cx(to), y: BUS_Y }, top(to)],
  pills: [label(text, { x: cx(to), y: (BUS_Y + y0(to)) / 2 })]
});

export const BOARD_ARROWS: BoardArrow[] = [
  across('kyb', 'identify'),
  across('identify', 'otp'),
  across('otp', 'not-eligible', (at) => label('Not Eligible', at)),
  drop('resume-cr', 'Resume CR'),
  drop('resume-fl', 'Resume Freelancer'),
  drop('progress', 'Submitted'),
  drop('live', 'Live'),
  // New eligible applicants: down from the OTP, then into each self-onboarding lane.
  {
    id: 'otp-new-cr',
    points: [bottom('otp'), { x: cx('otp'), y: NEW_Y }, { x: cx('cr-verify'), y: NEW_Y }, top('cr-verify')],
    pills: [label('New', { x: cx('otp'), y: (y0('otp') + G.boxH + NEW_Y) / 2 })]
  },
  {
    id: 'otp-new-fl',
    points: [{ x: cx('cr-verify'), y: NEW_Y }, { x: GAP_X, y: NEW_Y }, { x: GAP_X, y: cy('fl-certificate') }, left('fl-certificate')],
    pills: [label('New Freelancer', { x: GAP_X, y: cy('fl-certificate') - 150 })]
  },
  across('cr-verify', 'cr-details'),
  across('cr-details', 'cr-offer'),
  across('cr-offer', 'cr-review'),
  across('cr-review', 'cr-authorize'),
  across('cr-authorize', 'cr-nafath', (at) => label('Self', at)),
  across('cr-nafath', 'cr-contract'),
  across('cr-contract', 'cr-submitted'),
  // Signer handoff: down from the Authorization choice, back to the start of the signer lane.
  {
    id: 'authorize-handoff',
    points: [bottom('cr-authorize'), { x: cx('cr-authorize'), y: SIGNER_Y }, { x: cx('handoff'), y: SIGNER_Y }, top('handoff')],
    pills: [label('Send to signer', { x: cx('cr-authorize'), y: (y0('cr-authorize') + G.boxH + SIGNER_Y) / 2 })]
  },
  across('handoff', 'signer-link', (at) => label('SMS link', at)),
  across('signer-link', 'signer-nafath', (at) => check('Mobile match', at)),
  across('signer-nafath', 'signer-review'),
  across('signer-review', 'signer-contract'),
  across('signer-contract', 'signer-submitted'),
  {
    id: 'signer-delegation',
    dashed: true,
    points: [bottom('signer-link'), { x: cx('signer-link'), y: PHASE2_Y }, { x: cx('delegation'), y: PHASE2_Y }, bottom('delegation')],
    pills: [label('Phase 2', { x: (cx('signer-nafath') + cx('signer-review')) / 2, y: PHASE2_Y })]
  },
  across('fl-certificate', 'fl-nafath', (at) => check('Mobile match', at)),
  across('fl-nafath', 'fl-details'),
  across('fl-details', 'fl-offer'),
  across('fl-offer', 'fl-review'),
  across('fl-review', 'fl-contract'),
  across('fl-contract', 'fl-submitted')
];

export const BOARD_TITLE = 'Madfu Proposed · Merchant Onboarding';
export const BOARD_SUBTITLE = 'Master Board — the journey, screen by screen';
export const BOARD_LEGEND = [
  'Each box is the real Proposed screen',
  'Pill on a line = automatic check, no screen',
  'Dashed = Phase 2 / future'
];
