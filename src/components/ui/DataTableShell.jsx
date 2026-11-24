// قاب عمومی جدول؛ محتوای جدول و منطق ردیف‌ها را به صفحه واگذار می‌کند.
function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

function DataTableShell({
  title,
  description,
  actions,
  header,
  children,
  pagination,
  className = '',
  headerClassName = '',
  wrapperClassName = '',
  paginationClassName = '',
  bordered = false,
  as: Root = 'section',
  ...rootProps
}) {
  const hasGeneratedHeader = Boolean(title || description || actions);
  const hasHeader = header !== null && header !== undefined
    ? true
    : hasGeneratedHeader;

  return (
    <Root
      className={joinClasses('ui-data-table-card', className)}
      {...rootProps}
    >
      {hasHeader && (
        <header
          className={joinClasses(
            'ui-data-table-card__header',
            headerClassName
          )}
        >
          {header !== null && header !== undefined ? (
            header
          ) : (
            <>
              <div className="ui-data-table-card__heading">
                {title && (
                  <h2 className="ui-data-table-card__title">
                    {title}
                  </h2>
                )}

                {description && (
                  <p className="ui-data-table-card__description">
                    {description}
                  </p>
                )}
              </div>

              {actions && (
                <div className="ui-data-table-card__actions">
                  {actions}
                </div>
              )}
            </>
          )}
        </header>
      )}

      <div
        className={joinClasses(
          'ui-data-table-wrapper',
          bordered && 'ui-data-table-wrapper--bordered',
          wrapperClassName
        )}
      >
        {children}
      </div>

      {pagination !== null && pagination !== undefined && (
        <div
          className={joinClasses(
            'ui-data-table-pagination',
            paginationClassName
          )}
        >
          {pagination}
        </div>
      )}
    </Root>
  );
}

export default DataTableShell;
