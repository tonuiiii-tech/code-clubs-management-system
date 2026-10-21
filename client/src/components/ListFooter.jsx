import { Pagination } from 'steamlabsui';

/** "21–40 of 57" and page links under a list. */
export function ListFooter({ result, onPageChange }) {
  if (!result || result.total === 0) return null;
  const { page, pageSize, total } = result;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="table-footer">
      <span>
        {from}–{to} / {total}
      </span>
      {pageCount > 1 && (
        <Pagination page={page} pageCount={pageCount} onPageChange={onPageChange} />
      )}
    </div>
  );
}
