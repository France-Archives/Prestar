import type { ReactNode } from "react";
import { Info } from "lucide-react";
import StatusBadge from "@/components/data-display/StatusBadge";
import MetaGrid, { type MetaItem } from "@/components/layout/MetaGrid";

interface ItemCardProps {
  title: string;
  author?: string;
  cover?: string | null;
  status?: string;
  statusLabel?: string;
  metadata: MetaItem[];
  helper?: ReactNode;
  actions?: ReactNode;
}

export default function ItemCard({ title, author, cover, status, statusLabel, metadata, helper, actions }: ItemCardProps) {
  return (
    <article className="item-card">
      {cover ? <img className="item-card__cover" src={cover} alt="" /> : <div className="item-card__cover item-card__cover--placeholder" aria-hidden="true" />}
      <div className="item-card__body">
        <header className="item-card__header">
          <div>
            <h3 className="item-card__title">{title}</h3>
            {author && <p className="item-card__author">{author}</p>}
          </div>
          {status && <StatusBadge status={status} label={statusLabel} />}
        </header>
        <MetaGrid items={metadata} columns={3} />
        {helper && <p className="item-card__helper"><Info aria-hidden="true" />{helper}</p>}
        {actions && <footer className="item-card__actions">{actions}</footer>}
      </div>
    </article>
  );
}
