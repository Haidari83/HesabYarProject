// دکمه استاندارد رابط کاربری با گونه‌ها و اندازه‌های مشترک
function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

function Button({
  variant = 'primary',
  size = 'medium',
  type = 'button',
  iconOnly = false,
  loading = false,
  disabled = false,
  startIcon,
  endIcon,
  className = '',
  children,
  ...buttonProps
}) {
  const safeVariant = ['primary', 'secondary', 'danger', 'ghost'].includes(
    variant
  )
    ? variant
    : 'primary';

  const safeSize = ['small', 'medium', 'large'].includes(size)
    ? size
    : 'medium';

  return (
    <button
      {...buttonProps}
      type={type}
      className={joinClasses(
        'ui-button',
        `ui-button--${safeVariant}`,
        safeSize !== 'medium' && `ui-button--${safeSize}`,
        iconOnly && 'ui-button--icon',
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {startIcon !== null && startIcon !== undefined && (
        <span className="ui-button__start-icon" aria-hidden="true">
          {startIcon}
        </span>
      )}

      {children}

      {endIcon !== null && endIcon !== undefined && (
        <span className="ui-button__end-icon" aria-hidden="true">
          {endIcon}
        </span>
      )}
    </button>
  );
}

export default Button;
