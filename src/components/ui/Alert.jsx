// پیام عمومی برای نمایش موفقیت، هشدار، خطا و اطلاع‌رسانی

const DEFAULT_ICONS = {
  success: '✓',
  warning: '!',
  danger: '!',
  info: 'i',
};

import { joinClasses } from '../../utils/joinClasses';


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
  'aria-live': nativeAriaLive,
  'aria-atomic': nativeAriaAtomic,
  className = '',
  ...rest
}) {
  // فقط گونه‌های تعریف‌شده پذیرفته می‌شوند.
  const safeVariant = Object.hasOwn(DEFAULT_ICONS, variant)
    ? variant
    : 'info';

  // وضعیت پیش‌فرض برای پیام‌های عمومی، status است.
  // برای پیام‌های فوری باید role="alert" صریحاً تعیین شود.
  const resolvedRole = role === undefined
    ? 'status'
    : role;

  // نقش alert به‌صورت ضمنی assertive است.
  // برای status، مقدار polite را نیز صریح تعیین می‌کنیم.
  const defaultAriaLive =
    resolvedRole === 'status'
      ? 'polite'
      : undefined;

  const resolvedLive =
    ariaLive !== undefined
      ? ariaLive
      : nativeAriaLive !== undefined
        ? nativeAriaLive
        : defaultAriaLive;

  const isLiveRegion =
    resolvedRole === 'alert' ||
    resolvedRole === 'status';

  const resolvedAtomic =
    nativeAriaAtomic !== undefined
      ? nativeAriaAtomic
      : isLiveRegion
        ? 'true'
        : undefined;

  // آیکون سفارشی در اولویت است.
  // اگر آیکون تعیین نشده باشد، آیکون پیش‌فرض گونه انتخاب می‌شود.
  const resolvedIcon =
    icon === undefined
      ? DEFAULT_ICONS[safeVariant]
      : icon;

  const hasIcon =
    showIcon &&
    resolvedIcon !== null &&
    resolvedIcon !== false &&
    resolvedIcon !== true &&
    resolvedIcon !== '';

  // بررسی وجود عنوان و توضیحات بدون حذف مقدار معتبر صفر
  const hasTitle =
    title !== null &&
    title !== undefined &&
    title !== false &&
    title !== true &&
    title !== '';

  const hasChildren =
    children !== null &&
    children !== undefined &&
    children !== false &&
    children !== true &&
    children !== '';

  const hasContent = hasTitle || hasChildren;

  return (
    <div
      className={joinClasses(
        'ui-alert',
        `ui-alert--${safeVariant}`,
        inline && 'ui-alert--inline',
        className
      )}
      {...rest}
    >
      {/* آیکون تزئینی پیام */}
      {hasIcon && (
        <span
          className="ui-alert__icon"
          aria-hidden="true"
        >
          {resolvedIcon}
        </span>
      )}

      {/* ناحیه متنی پیام؛ بدون کنترل تعاملی */}
      {hasContent && (
        <div
          className="ui-alert__content"
          role={resolvedRole || undefined}
          aria-live={resolvedLive}
          aria-atomic={resolvedAtomic}
        >
          {hasTitle && (
            <strong>{title}</strong>
          )}

          {hasChildren && (
            <div className="ui-alert__description">
              {children}
            </div>
          )}
        </div>
      )}

      {/* دکمه بستن خارج از ناحیه زنده پیام */}
      {closable && typeof onClose === 'function' && (
        <button
          type="button"
          className="ui-alert__close"
          onClick={onClose}
          aria-label={closeLabel || 'بستن پیام'}
        >
          ×
        </button>
      )}
    </div>
  );
}

export default Alert;