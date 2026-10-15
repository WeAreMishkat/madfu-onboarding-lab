import { ASSUMPTIONS, DECISION_TABLES, PENDING_DECISIONS, type Table } from './model/decisions';

export function DecisionTable({ table }: { table: Table }) {
  return (
    <section className="dt" aria-label={table.title}>
      <h2 className="dt-title">{table.title}</h2>
      <div className="dt-scroll">
        <table>
          <thead><tr>{table.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {table.note && <p className="dt-note">{table.note}</p>}
    </section>
  );
}

export function DecisionTables() {
  return (
    <div className="dt-page">
      {DECISION_TABLES.map((t) => <DecisionTable key={t.id} table={t} />)}
      <section className="dt">
        <h2 className="dt-title">Assumptions in this prototype</h2>
        <ul className="dt-list">{ASSUMPTIONS.map((a) => <li key={a}>{a}</li>)}</ul>
      </section>
      <section className="dt">
        <h2 className="dt-title">Pending product decisions</h2>
        <ol className="dt-list">{PENDING_DECISIONS.map((a) => <li key={a}>{a}</li>)}</ol>
      </section>
    </div>
  );
}
