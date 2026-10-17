-- Server/sql/borrow_flow_v3.sql
-- Idempotent schema modifications for Borrow Request Flow V3
BEGIN;

-- a. book_copies: replace chk_copy_status so it also allows 'Reserved'
ALTER TABLE public.book_copies DROP CONSTRAINT IF EXISTS chk_copy_status;
ALTER TABLE public.book_copies ADD CONSTRAINT chk_copy_status
  CHECK ((status)::text = ANY (ARRAY['Available'::text, 'Reserved'::text, 'Borrowed'::text, 'Maintenance'::text, 'Lost'::text]));

-- b. borrow_requests: replace borrow_requests_status_check so it also allows 'Expired'
ALTER TABLE public.borrow_requests DROP CONSTRAINT IF EXISTS borrow_requests_status_check;
ALTER TABLE public.borrow_requests ADD CONSTRAINT borrow_requests_status_check
  CHECK ((status)::text = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Rejected'::text, 'Cancelled'::text, 'Fulfilled'::text, 'Expired'::text]));

-- c. borrowed_books modifications
ALTER TABLE public.borrowed_books DROP CONSTRAINT IF EXISTS borrowed_books_status_check;
ALTER TABLE public.borrowed_books ADD CONSTRAINT borrowed_books_status_check
  CHECK ((status)::text = ANY (ARRAY['Reserved'::text, 'Borrowed'::text, 'Returned'::text, 'Lost'::text, 'Cancelled'::text]));

ALTER TABLE public.borrowed_books ALTER COLUMN due_date DROP NOT NULL;
ALTER TABLE public.borrowed_books ALTER COLUMN issued_by DROP NOT NULL;

ALTER TABLE public.borrowed_books ADD COLUMN IF NOT EXISTS assigned_by bigint;
ALTER TABLE public.borrowed_books ADD COLUMN IF NOT EXISTS assigned_at timestamp with time zone;
ALTER TABLE public.borrowed_books ADD COLUMN IF NOT EXISTS picked_up_at timestamp with time zone;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'borrowed_books_assigned_by_fkey'
  ) THEN
    ALTER TABLE public.borrowed_books
      ADD CONSTRAINT borrowed_books_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(user_id);
  END IF;
END $$;

ALTER TABLE public.borrowed_books DROP CONSTRAINT IF EXISTS chk_borrowed_books_stage;
ALTER TABLE public.borrowed_books ADD CONSTRAINT chk_borrowed_books_stage
  CHECK ((status)::text = ANY (ARRAY['Reserved'::text, 'Cancelled'::text]) OR (due_date IS NOT NULL AND issued_by IS NOT NULL));

-- d. Replace uq_borrowed_books_active_copy with status IN ('Reserved', 'Borrowed')
DROP INDEX IF EXISTS public.uq_borrowed_books_active_copy;
CREATE UNIQUE INDEX IF NOT EXISTS uq_borrowed_books_active_copy
  ON public.borrowed_books USING btree (book_id, copy_id)
  WHERE (status)::text = ANY (ARRAY['Reserved'::text, 'Borrowed'::text]);

-- e. Partial UNIQUE index on borrow_requests(user_id, book_id) WHERE status IN ('Pending','Approved')
CREATE UNIQUE INDEX IF NOT EXISTS uq_borrow_requests_active_per_book
  ON public.borrow_requests USING btree (user_id, book_id)
  WHERE (status)::text = ANY (ARRAY['Pending'::text, 'Approved'::text]);

-- f. Index on borrow_requests(status, request_date)
CREATE INDEX IF NOT EXISTS idx_borrow_requests_status_date
  ON public.borrow_requests USING btree (status, request_date);

-- g. Create view v_user_active_penalties (user_id, penalty_id, borrow_id, penalty_type, amount, amount_paid, balance, status)
CREATE OR REPLACE VIEW public.v_user_active_penalties AS
SELECT
    br.user_id,
    p.penalty_id,
    p.borrow_id,
    p.penalty_type,
    p.amount,
    COALESCE(SUM(pay.amount) FILTER (WHERE pay.payment_status = 'Completed'), 0.00)::numeric(10,2) AS amount_paid,
    (p.amount - COALESCE(SUM(pay.amount) FILTER (WHERE pay.payment_status = 'Completed'), 0.00))::numeric(10,2) AS balance,
    p.status
FROM public.penalties p
JOIN public.borrowed_books bb ON bb.borrow_id = p.borrow_id
JOIN public.borrow_requests br ON br.request_id = bb.request_id
LEFT JOIN public.payments pay ON pay.penalty_id = p.penalty_id
WHERE (p.status)::text = ANY (ARRAY['Unpaid'::text, 'Partially Paid'::text])
GROUP BY br.user_id, p.penalty_id, p.borrow_id, p.penalty_type, p.amount, p.status;

-- h. Trigger fn_check_no_active_penalty BEFORE INSERT ON borrow_requests
CREATE OR REPLACE FUNCTION public.fn_check_no_active_penalty()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.v_user_active_penalties
        WHERE user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'Borrowing request denied: student has active unpaid penalties.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_no_active_penalty ON public.borrow_requests;
CREATE TRIGGER trg_check_no_active_penalty
BEFORE INSERT ON public.borrow_requests
FOR EACH ROW
EXECUTE FUNCTION public.fn_check_no_active_penalty();

-- i. Additional supporting indexes for penalty and borrow lookup efficiency
CREATE INDEX IF NOT EXISTS idx_penalties_borrow_id ON public.penalties USING btree (borrow_id);
CREATE INDEX IF NOT EXISTS idx_payments_penalty_id ON public.payments USING btree (penalty_id);
CREATE INDEX IF NOT EXISTS idx_borrowed_books_status ON public.borrowed_books USING btree (status);

COMMIT;
