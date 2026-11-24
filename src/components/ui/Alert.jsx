// پیام عمومی برای نمایش موفقیت، هشدار، خطا و اطلاع‌رسانی
const DEFAULT_ICONS = {
  success: '✓',
  warning: '!',
  danger: '!',
  info: 'i',
};

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

function Alert({
  variant = 'info',
  inline = false,
  title,
  children,
  icon,
  showIcon = true,
  closable = false,
  onClose,
  closeLabel = 'بستن پیام',
  role,
  ariaLive,
  className = '',
  ...rest
}) {
  const safeVariant = Object.hasOwn(DEFAULT_ICONS, variant)
    ? variant
    : 'info';

  const resolvedRole =
    role || (safeVariant === 'danger' ? 'alert' : 'status');

  const resolvedLive =
    ariaLive || (resolvedRole === 'alert' ? 'assertive' : 'polite');

  const resolvedIcon =
    icon === undefined ? DEFAULT_ICONS[safeVariant] : icon;

  return (
    <div
      className={joinClasses(
        'ui-alert',
        `ui-alert--${safeVariant}`,
        inline && 'ui-alert--inline',
        className
      )}
      role={resolvedRole}
      aria-live={resolvedLive}
      aria-atomic="true"
      {...rest}
    >
      {showIcon && resolvedIcon !== null && (
        <span className="ui-alert__icon" aria-hidden="true">
          {resolvedIcon}
        </span>
      )}

      {title ? (
        <div className="ui-alert__content">
          <strong>{title}</strong>
          {children !== null && children !== undefined && (
            <p>{children}</p>
          )}
        </div>
      ) : inline ? (
        <p>{children}</p>
      ) : (
        <div className="ui-alert__content">{children}</div>
      )}

      {closable && typeof onClose === 'function' && (
        <button
          type="button"
          className="ui-alert__close"
          onClick={onClose}
          aria-label={closeLabel}
        >
          ×
        </button>
      )}
    </div>
  );
}

export default Alert;
