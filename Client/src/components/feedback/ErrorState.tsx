import Button from "../ui/Button";

interface ErrorStateProps {
  message: string;
  requestId?: string;
  onRetry?: () => void;
}

export default function ErrorState({ message, requestId, onRetry }: ErrorStateProps) {
  return (
    <div className="empty" role="alert">
      <h3>Something went wrong</h3>
      <p className="subtle">{message}</p>
      {requestId && <p className="subtle">Reference: {requestId}</p>}
      {onRetry && (
        <Button variant="ghost" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}