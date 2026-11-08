export type SummaryRow = { label: string; value: string; cell: string };

export function SummaryTable(props: { caption: string; rows: SummaryRow[]; emptyText: string }) {
  if (props.rows.length === 0) return <p class="empty-inline">{props.emptyText}</p>;
  return (
    <table class="data-table summary-table">
      <caption class="visually-hidden">{props.caption}</caption>
      <tbody>
        {props.rows.map((row) => (
          <tr>
            <th scope="row">{row.label}</th>
            <td data-label={row.label} data-cell={row.cell}>
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
