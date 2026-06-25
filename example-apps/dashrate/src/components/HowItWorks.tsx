export function HowItWorks() {
  return (
    <section className="panel">
      <h2>How it works</h2>
      <p>
        DashRate stores one mutable <code>review</code> document per identity
        and resource. The unique <code>$ownerId + resourceId</code> index
        prevents duplicate reviews by the same identity, so saving again edits
        the existing document instead of creating a second one.
      </p>
      <ul>
        <li>
          <code>documents.query</code> loads recent reviews by{" "}
          <code>resourceId</code>, My reviews by <code>$ownerId</code>, and the
          current user's review by <code>$ownerId + resourceId</code>. Adding a{" "}
          <code>rating == N</code> clause filters the list to a single star
          value — covered by the <code>[resourceId, rating]</code> index.
        </li>
        <li>
          <code>documents.count</code> on the countable <code>resourceId</code>{" "}
          index returns a resource's total review count — the basic count
          pattern.
        </li>
        <li>
          <code>documents.count</code> with <code>groupBy: ["rating"]</code>{" "}
          returns one count per star value — the rating distribution shown as
          bars. The <code>rating between [1, 5]</code> range over the countable{" "}
          <code>[resourceId, rating]</code> index drives the grouped walk. The
          average is computed from these per-star counts, so no separate{" "}
          <code>sum</code> / <code>average</code> query is needed.
        </li>
        <li>
          <code>documents.history</code> shows how a user's review changed
          across revisions because the document type keeps history.
        </li>
      </ul>
    </section>
  );
}
