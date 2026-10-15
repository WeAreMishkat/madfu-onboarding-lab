/**
 * Journey maps for Madfu Proposed. Laid out on a small grid (col, row) so each map stays readable.
 * Node kinds are drawn differently: user screen, decision, backend check, external verification,
 * manual route and outcome.
 */
export type NodeKind = 'screen' | 'decision' | 'backend' | 'external' | 'manual' | 'outcome' | 'connector';

export interface MapNode { id: string; kind: NodeKind; label: string; col: number; row: number }
export interface MapEdge { from: string; to: string; label?: string; dashed?: boolean }
export interface JourneyMap { id: 'overview' | 'cr' | 'fl' | 'manual'; title: string; caption: string; nodes: MapNode[]; edges: MapEdge[] }

export const NODE_KIND_LABEL: Record<NodeKind, string> = {
  screen: 'User screen',
  decision: 'Decision',
  backend: 'Backend check',
  external: 'External verification',
  manual: 'Manual route',
  outcome: 'Outcome',
  connector: 'Continues'
};

/**
 * Split a wide map into two readable parts (used by the PDF). Edges that cross the split end at,
 * and start from, labelled connector nodes.
 */
export function splitMap(map: JourneyMap, at: number): [JourneyMap, JourneyMap] | null {
  const maxCol = Math.max(...map.nodes.map((n) => n.col));
  if (maxCol < at + 2) return null;
  const left = map.nodes.filter((n) => n.col < at);
  const right = map.nodes.filter((n) => n.col >= at).map((n) => ({ ...n, col: n.col - at + 1 }));
  const inLeft = new Set(left.map((n) => n.id));
  const labelOf = (id: string) => map.nodes.find((n) => n.id === id)!.label;
  const a: JourneyMap = { ...map, title: `${map.title} (part 1 of 2)`, nodes: [...left], edges: [] };
  const b: JourneyMap = { ...map, title: `${map.title} (part 2 of 2)`, nodes: [...right], edges: [] };
  for (const e of map.edges) {
    const fromLeft = inLeft.has(e.from);
    const toLeft = inLeft.has(e.to);
    if (fromLeft && toLeft) a.edges.push(e);
    else if (!fromLeft && !toLeft) b.edges.push(e);
    else if (fromLeft) {
      // Forward crossing: left part ends at a connector, right part starts from one.
      const src = map.nodes.find((n) => n.id === e.from)!;
      const dst = right.find((n) => n.id === e.to)!;
      const outId = `out-${e.from}-${e.to}`;
      const inId = `in-${e.from}-${e.to}`;
      a.nodes.push({ id: outId, kind: 'connector', label: `Continues → ${labelOf(e.to)}`, col: at, row: src.row });
      a.edges.push({ from: e.from, to: outId, label: e.label, dashed: e.dashed });
      b.nodes.push({ id: inId, kind: 'connector', label: `From ← ${labelOf(e.from)}`, col: 0, row: dst.row });
      b.edges.push({ from: inId, to: e.to, dashed: e.dashed });
    } else {
      // Backward crossing (a loop back to part 1): shown as a connector in each part.
      const src = right.find((n) => n.id === e.from)!;
      const dst = map.nodes.find((n) => n.id === e.to)!;
      const backId = `back-${e.from}-${e.to}`;
      const retId = `ret-${e.from}-${e.to}`;
      b.nodes.push({ id: backId, kind: 'connector', label: `Back to ← ${labelOf(e.to)}`, col: 0, row: src.row + 1 });
      b.edges.push({ from: e.from, to: backId, label: e.label, dashed: true });
      a.nodes.push({ id: retId, kind: 'connector', label: `Returns from ${labelOf(e.from)}`, col: at, row: dst.row + 1 });
      a.edges.push({ from: retId, to: e.to, dashed: true });
    }
  }
  return [a, b];
}

export const MAPS: JourneyMap[] = [
  {
    id: 'overview',
    title: 'Overview',
    caption: 'One entry page for both applicant types. Identity is checked before the mobile; routing happens only after the SMS code.',
    nodes: [
      { id: 'entry', kind: 'screen', label: 'Entry page: type, CR / National ID, revenue, mobile', col: 0, row: 1 },
      { id: 'idcheck', kind: 'backend', label: 'Identity check (before mobile matching)', col: 1, row: 1 },
      { id: 'otp', kind: 'screen', label: 'SMS code', col: 2, row: 1 },
      { id: 'idres', kind: 'decision', label: 'Identity result?', col: 3, row: 1 },
      { id: 'existing', kind: 'outcome', label: 'Existing merchant / duplicate: no new application', col: 3, row: 0 },
      { id: 'resume', kind: 'screen', label: 'Resume saved application', col: 3, row: 2 },
      { id: 'route', kind: 'decision', label: 'Type + revenue', col: 4, row: 1 },
      { id: 'lead', kind: 'outcome', label: 'CR outside SAR 100K–20M: Sales lead', col: 4, row: 0 },
      { id: 'cat', kind: 'screen', label: 'Category screening', col: 5, row: 1 },
      { id: 'blocked', kind: 'outcome', label: 'Restricted: neutral confirmation', col: 5, row: 0 },
      { id: 'verify', kind: 'external', label: 'CR: registry + people + Nafath · FL: Nafath + certificates', col: 6, row: 1 },
      { id: 'biz', kind: 'screen', label: 'Business details: IBAN, VAT, channels', col: 7, row: 1 },
      { id: 'review', kind: 'screen', label: 'Review + Edit', col: 8, row: 1 },
      { id: 'gate', kind: 'decision', label: 'Nafath verified?', col: 9, row: 1 },
      { id: 'contract', kind: 'screen', label: 'Contract', col: 10, row: 1 },
      { id: 'submitted', kind: 'outcome', label: 'Submitted · under review', col: 11, row: 1 },
      { id: 'manual', kind: 'manual', label: 'Manual verification (no contract)', col: 10, row: 2 }
    ],
    edges: [
      { from: 'entry', to: 'idcheck' }, { from: 'idcheck', to: 'otp' }, { from: 'otp', to: 'idres', label: 'verified' },
      { from: 'idres', to: 'existing', label: 'exists' }, { from: 'idres', to: 'resume', label: 'saved' }, { from: 'idres', to: 'route', label: 'new' },
      { from: 'route', to: 'lead', label: 'CR' }, { from: 'route', to: 'cat', label: 'self-service' }, { from: 'cat', to: 'blocked', label: 'blocked' },
      { from: 'cat', to: 'verify' }, { from: 'verify', to: 'biz' }, { from: 'biz', to: 'review' }, { from: 'review', to: 'gate' },
      { from: 'gate', to: 'contract', label: 'yes' }, { from: 'contract', to: 'submitted', label: 'accept' }, { from: 'gate', to: 'manual', label: 'no' }
    ]
  },
  {
    id: 'cr',
    title: 'Registered business',
    caption: 'Self-service band only (SAR 100K–20M). Nafath verifies identity and authority; the contract is a separate step.',
    nodes: [
      { id: 'cat', kind: 'screen', label: 'Category screening', col: 0, row: 1 },
      { id: 'crv', kind: 'external', label: 'CR verification (mock provider)', col: 1, row: 1 },
      { id: 'crres', kind: 'decision', label: 'Registration result?', col: 2, row: 1 },
      { id: 'invalid', kind: 'outcome', label: 'Not found: cannot continue (edit CR)', col: 2, row: 0 },
      { id: 'retry', kind: 'backend', label: 'Unavailable: retry (bounded), progress kept', col: 2, row: 2 },
      { id: 'people', kind: 'external', label: 'Associated parties (individuals only)', col: 3, row: 1 },
      { id: 'pick', kind: 'screen', label: 'Select authorised person', col: 4, row: 1 },
      { id: 'none', kind: 'manual', label: 'No eligible individual: manual authority check', col: 4, row: 2 },
      { id: 'nafath', kind: 'external', label: 'Nafath request (2 attempts per application)', col: 5, row: 1 },
      { id: 'nres', kind: 'decision', label: 'Verified? (1st failure: retry or another person)', col: 6, row: 1 },
      { id: 'nfail', kind: 'manual', label: 'Failed twice: unverified, manual verification', col: 6, row: 2 },
      { id: 'biz', kind: 'screen', label: 'Business details', col: 7, row: 1 },
      { id: 'iban', kind: 'external', label: 'IBAN ownership vs business (2 attempts)', col: 8, row: 1 },
      { id: 'review', kind: 'screen', label: 'Review', col: 9, row: 1 },
      { id: 'contract', kind: 'screen', label: 'Contract', col: 10, row: 1 },
      { id: 'done', kind: 'outcome', label: 'Submitted', col: 11, row: 1 }
    ],
    edges: [
      { from: 'cat', to: 'crv' }, { from: 'crv', to: 'crres' }, { from: 'crres', to: 'invalid', label: 'not found' }, { from: 'crres', to: 'retry', label: 'unavailable' },
      { from: 'crres', to: 'people', label: 'valid / expired (flag)' }, { from: 'people', to: 'pick' },
      { from: 'people', to: 'none', label: 'none' }, { from: 'pick', to: 'nafath' }, { from: 'nafath', to: 'nres' },
      { from: 'nres', to: 'nfail', label: 'failed twice' }, { from: 'nres', to: 'biz', label: 'yes' }, { from: 'none', to: 'biz', dashed: true }, { from: 'nfail', to: 'biz', dashed: true },
      { from: 'biz', to: 'iban' }, { from: 'iban', to: 'review' }, { from: 'review', to: 'contract', label: 'Nafath verified' }, { from: 'contract', to: 'done' }
    ]
  },
  {
    id: 'fl',
    title: 'Freelancer',
    caption: 'Self-service at every revenue level. The National ID from the entry page drives Nafath; certificates are retrieved, not typed.',
    nodes: [
      { id: 'cat', kind: 'screen', label: 'Category screening (CR-only → flag, continue)', col: 0, row: 1 },
      { id: 'nafath', kind: 'external', label: 'Nafath with entry National ID (2 attempts)', col: 1, row: 1 },
      { id: 'nres', kind: 'decision', label: 'Verified?', col: 2, row: 1 },
      { id: 'certs', kind: 'external', label: 'Retrieve freelance certificates', col: 3, row: 1 },
      { id: 'cres', kind: 'decision', label: 'Certificates?', col: 4, row: 1 },
      { id: 'select', kind: 'screen', label: 'Select certificate', col: 5, row: 1 },
      { id: 'recon', kind: 'backend', label: 'Duplicate check + category reconciliation', col: 6, row: 1 },
      { id: 'manual', kind: 'manual', label: 'Certificate number by hand', col: 4, row: 2 },
      { id: 'biz', kind: 'screen', label: 'Business details', col: 7, row: 1 },
      { id: 'iban', kind: 'external', label: 'IBAN ownership vs individual', col: 8, row: 1 },
      { id: 'ibann', kind: 'manual', label: 'IBAN collected, no ownership check', col: 8, row: 2 },
      { id: 'review', kind: 'screen', label: 'Review', col: 9, row: 1 },
      { id: 'contract', kind: 'screen', label: 'Contract', col: 10, row: 1 },
      { id: 'done', kind: 'outcome', label: 'Submitted', col: 11, row: 1 },
      { id: 'mv', kind: 'outcome', label: 'Manual verification', col: 10, row: 2 }
    ],
    edges: [
      { from: 'cat', to: 'nafath' }, { from: 'nafath', to: 'nres' }, { from: 'nres', to: 'certs', label: 'yes' }, { from: 'nres', to: 'manual', label: 'failed twice' },
      { from: 'certs', to: 'cres' }, { from: 'cres', to: 'select', label: 'one / several' }, { from: 'cres', to: 'manual', label: 'none / unavailable', dashed: true },
      { from: 'select', to: 'recon' }, { from: 'recon', to: 'biz' }, { from: 'biz', to: 'iban', label: 'Nafath verified' }, { from: 'manual', to: 'ibann', dashed: true },
      { from: 'iban', to: 'review' }, { from: 'ibann', to: 'review', dashed: true }, { from: 'review', to: 'contract', label: 'eligible' }, { from: 'contract', to: 'done' },
      { from: 'review', to: 'mv', label: 'not eligible' }
    ]
  },
  {
    id: 'manual',
    title: 'Manual-review paths',
    caption: 'What sends an application to people, and what the applicant sees. Internal reasons are never shown.',
    nodes: [
      { id: 'blocked', kind: 'decision', label: 'Restricted category', col: 0, row: 0 },
      { id: 'blocked-o', kind: 'outcome', label: 'Neutral thank-you; no paid checks run', col: 1, row: 0 },
      { id: 'noperson', kind: 'decision', label: 'No eligible individual (CR)', col: 0, row: 1 },
      { id: 'nafath2', kind: 'decision', label: 'Nafath failed twice', col: 0, row: 2 },
      { id: 'certman', kind: 'decision', label: 'Certificate typed by hand (FL)', col: 0, row: 3 },
      { id: 'mv', kind: 'manual', label: 'Data collected, no contract', col: 1, row: 2 },
      { id: 'mv-o', kind: 'outcome', label: '"We have received your application"', col: 2, row: 2 },
      { id: 'flags', kind: 'backend', label: 'Flags only: expired CR, IBAN unverified, category review, CR-only FL, certificate mismatch', col: 0, row: 4 },
      { id: 'flags-o', kind: 'outcome', label: 'Contract still available if Nafath verified; review team sees flags', col: 1, row: 4 }
    ],
    edges: [
      { from: 'blocked', to: 'blocked-o' }, { from: 'noperson', to: 'mv' }, { from: 'nafath2', to: 'mv' }, { from: 'certman', to: 'mv' },
      { from: 'mv', to: 'mv-o' }, { from: 'flags', to: 'flags-o' }
    ]
  }
];
