// برچسب عمومی نمایش وضعیت‌ها
function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

function StatusBadge({
  variant = 'neutral',
  children,
  label,
  icon,
  className = '',
  ...badgeProps
}) {
  const safeVariant = [
    'success',
    'warning',
    'danger',
    'info',
    'neutral',
    'primary',
  ].includes(variant)
    ? variant
    : 'neutral';

  const content = label !== null && label !== undefined
    ? label
    : children;

  return (
    <span
      className={joinClasses(
        'ui-badge',
        `ui-badge--${safeVariant}`,
        className
      )}
      {...badgeProps}
    >
      {icon !== null && icon !== undefined && (
        <span className="ui-badge__icon" aria-hidden="true">
          {icon}
        </span>
      )}

      {content}
    </span>
  );
}

export default StatusBadge;
