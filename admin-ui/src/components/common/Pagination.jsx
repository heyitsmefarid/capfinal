import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Reusable pagination component. Renders the exact same markup/classes as
 * the inline pagination duplicated across Applications, AcademicRecords,
 * Scholars, Attendance, ScholarshipEvaluation — so every page's pagination
 * looks and behaves identically, whether it uses this component or its own
 * inline copy. See global.css's .pagination-container block for the shared
 * styling (info left, Previous/Page/Next centered, per-page select right).
 */
export default function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  pageSizeOptions = [5, 10, 25, 50, 100],
  itemLabel = 'items',
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const handlePrev = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  };

  return (
    <div className="pagination-container">
      <div className="pagination-info">
        Showing {startItem} to {endItem} of {totalItems} {itemLabel}
      </div>

      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn"
          onClick={handlePrev}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={18} />
          Previous
        </button>

        <span style={{ padding: '0 1rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
          Page {currentPage} of {totalPages}
        </span>

        <button
          type="button"
          className="pagination-btn"
          onClick={handleNext}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          Next
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="pagination-select-container">
        {onItemsPerPageChange && (
          <>
            <label>Items per page:</label>
            <select
              className="pagination-select"
              value={itemsPerPage}
              onChange={(e) => {
                onItemsPerPageChange(Number(e.target.value));
                onPageChange(1);
              }}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
    </div>
  );
}
