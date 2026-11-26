// نمایش یکپارچه وضعیت خالی فهرست‌ها و جدول‌ها
import { joinClasses } from '../../utils/joinClasses';


function EmptyState({
  icon,
  title,
  description,
  children,
  variant = 'default',
  compact = false,
  className = '',
  role = 'status',
  ...containerProps
}) {
  const isTable = variant === 'table' || variant === 'table-compact';
  const isCompact = compact || variant === 'table-compact';

  return (
    <div
      className={joinClasses(
        'ui-empty-state',
        isTable && 'ui-empty-state--table',
        isCompact && isTable && 'ui-empty-state--table-compact',
        className
      )}
      role={role}
      aria-live={role === 'status' ? 'polite' : undefined}
      {...containerProps}
    >
      {icon !== null && icon !== undefined && (
        <span className="ui-empty-state__icon" aria-hidden="true">
          {icon}
        </span>
      )}

      {title && <strong>{title}</strong>}

      {description && <p>{description}</p>}

      {children}
    </div>
  );
}

export default EmptyState;
