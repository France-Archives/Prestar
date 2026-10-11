import { Link } from "react-router-dom";
import Card from "@/components/ui/Card";
import BookGrid from "@/features/books/components/BookGrid";
import { ROUTES } from "@/app/routeConfig";
import type { BookSummary } from "@/types";

// TEMPORARY MOCK: recommendations come from a fixed list. The real backend derives them from interests and borrowing history.
export default function RecommendedBooks({ books }: { books: BookSummary[] }) {
  return (
    <Card title="Recommended for you" note="Based on your interests." actions={<Link to={ROUTES.student.interests} className="link-btn">Edit interests</Link>}>
      <BookGrid books={books} emptyText="No recommendations yet." />
    </Card>
  );
}