import styles from './Pagination.module.scss';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    maxVisiblePages?: number;
}

export default function Pagination({ 
    currentPage, 
    totalPages, 
    onPageChange, 
    maxVisiblePages = 5 
}: PaginationProps) {
    
    const getVisiblePages = () => {
        const pages = [];
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }
        
        return pages;
    };

    const visiblePages = getVisiblePages();

    return (
        <div className={styles.pagination}>
            <button 
                className={`${styles.arrowButton} ${currentPage === 1 ? styles.disabled : ''}`}
                onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
            >
                &lt;
            </button>
            
            {visiblePages[0] > 1 && (
                <>
                    <button 
                        className={styles.pageButton}
                        onClick={() => onPageChange(1)}
                    >
                        1
                    </button>
                    {visiblePages[0] > 2 && (
                        <span className={styles.ellipsis}>...</span>
                    )}
                </>
            )}
            
            {visiblePages.map(page => (
                <button
                    key={page}
                    className={`${styles.pageButton} ${currentPage === page ? styles.active : ''}`}
                    onClick={() => onPageChange(page)}
                >
                    {page}
                </button>
            ))}
            
            {visiblePages[visiblePages.length - 1] < totalPages && (
                <>
                    {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
                        <span className={styles.ellipsis}>...</span>
                    )}
                    <button 
                        className={styles.pageButton}
                        onClick={() => onPageChange(totalPages)}
                    >
                        {totalPages}
                    </button>
                </>
            )}
            
            <button 
                className={`${styles.arrowButton} ${currentPage === totalPages ? styles.disabled : ''}`}
                onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
            >
                &gt;
            </button>
        </div>
    );
}