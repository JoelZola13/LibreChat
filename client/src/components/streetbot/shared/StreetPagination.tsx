import type { CSSProperties } from 'react';

type PaginationColors = {
  accent: string;
  text: string;
};

type StreetPaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  colors: PaginationColors;
  marginTop?: number;
};

export default function StreetPagination({
  currentPage,
  totalPages,
  onPageChange,
  colors,
  marginTop = 32,
}: StreetPaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i += 1) pages.push(i);
  } else {
    const near = new Set<number>();
    near.add(1);
    near.add(2);
    near.add(3);
    near.add(totalPages);
    near.add(currentPage);
    if (currentPage > 1) near.add(currentPage - 1);
    if (currentPage < totalPages) near.add(currentPage + 1);

    const sorted = Array.from(near)
      .filter((page) => page >= 1 && page <= totalPages)
      .sort((left, right) => left - right);

    for (let index = 0; index < sorted.length; index += 1) {
      if (index > 0 && sorted[index] - sorted[index - 1] > 1) pages.push('...');
      pages.push(sorted[index]);
    }
  }

  const buttonBase: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 600,
    transition: 'all 0.15s',
    background: 'transparent',
    color: colors.text,
  };

  return (
    <nav
      aria-label="Pagination"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginTop,
      }}
    >
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        style={{
          ...buttonBase,
          opacity: currentPage === 1 ? 0.3 : 1,
          cursor: currentPage === 1 ? 'default' : 'pointer',
        }}
        aria-label="Previous page"
      >
        ←
      </button>

      {pages.map((page, index) =>
        page === '...' ? (
          <span
            key={`ellipsis-${index}`}
            style={{
              width: 44,
              textAlign: 'center',
              color: colors.text,
              fontSize: 16,
              userSelect: 'none',
            }}
          >
            …
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            style={{
              ...buttonBase,
              background: page === currentPage ? colors.accent : 'transparent',
              color: page === currentPage ? '#000' : colors.text,
              fontWeight: page === currentPage ? 700 : 500,
            }}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        style={{
          ...buttonBase,
          opacity: currentPage === totalPages ? 0.3 : 1,
          cursor: currentPage === totalPages ? 'default' : 'pointer',
        }}
        aria-label="Next page"
      >
        →
      </button>
    </nav>
  );
}
