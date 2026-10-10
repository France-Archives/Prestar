import { Link } from "react-router-dom";
import Card from "@/components/ui/Card";
import { ROUTES } from "@/app/routeConfig";
import type { PopularBook } from "@/types";

export default function MostBorrowedBooks({ books }: { books: PopularBook[] }) {
  return (
    <Card title="Most borrowed">
      {books.length === 0 ? (
        <p className="subtle">No data yet.</p>
      ) : (
        <ol style={{ paddingLeft: 18, display: "grid", gap: 6 }}>
          {books.map((b) => (
            <li key={b.bookId}>
              <Link to={ROUTES.student.bookDetails(b.bookId)}>{b.title}</Link> <span className="subtle">· {b.loanCount} loans</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}