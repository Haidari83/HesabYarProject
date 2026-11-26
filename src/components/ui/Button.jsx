import { forwardRef } from 'react';


// =============================================
// کامپوننت مرکزی دکمه‌های حساب‌یار
// =============================================


// ترکیب چند کلاس CSS و حذف مقدارهای خالی
import { joinClasses } from '../../utils/joinClasses';



/**
 * دکمه استاندارد برنامه
 *
 * variant:
 *   primary   = اصلی
 *   secondary = فرعی
 *   danger    = خطرناک
 *   ghost     = شفاف
 *   success   = موفقیت
 *   warning   = هشدار
 *
 * size:
 *   small  = کوچک
 *   medium = متوسط
 *   large  = بزرگ
 *
 * سایر ویژگی‌ها:
 *   iconOnly  = دکمه فقط آیکون
 *   loading   = حالت بارگذاری
 *   fullWidth = تمام عرض
 *   startIcon = آیکون ابتدای متن
 *   endIcon   = آیکون انتهای متن
 */
const Button = forwardRef(function Button({
  // نوع ظاهری دکمه
  variant = 'primary',

  // اندازه دکمه
  size = 'medium',

  // نوع پیش‌فرض دکمه برای جلوگیری از ارسال ناخواسته فرم
  type = 'button',

  // آیا دکمه فقط آیکون دارد؟
  iconOnly = false,

  // آیا عملیات در حال اجرا است؟
  loading = false,

  // وضعیت غیرفعال بودن دکمه
  disabled = false,

  // آیا دکمه تمام عرض محفظه را بگیرد؟
  fullWidth = false,

  // آیکون سمت راست متن
  startIcon,

  // آیکون سمت چپ متن
  endIcon,

  // کلاس اختصاصی
  className = '',

  // محتوای داخل دکمه
  children,

  // حفظ aria-busy ارسالی از کامپوننت مصرف‌کننده
  'aria-busy': ariaBusy,

  // سایر ویژگی‌های استاندارد HTML
  ...buttonProps
}, ref) {

  // گونه‌های مجاز دکمه
  const allowedVariants = [
    'primary',
    'secondary',
    'danger',
    'ghost',
    'success',
    'warning',
  ];

  // اندازه‌های مجاز دکمه
  const allowedSizes = [
    'small',
    'medium',
    'large',
  ];

  // جلوگیری از دریافت گونه نامعتبر
  const safeVariant = allowedVariants.includes(variant)
    ? variant
    : 'primary';

  // جلوگیری از دریافت اندازه نامعتبر
  const safeSize = allowedSizes.includes(size)
    ? size
    : 'medium';


  return (
    <button
      // انتقال ref به عنصر واقعی HTML
      ref={ref}
      // انتقال ویژگی‌هایی مانند onClick و aria-label
      {...buttonProps}

      // تعیین نوع دکمه
      type={type}

      // ساخت کلاس‌های نهایی
      className={joinClasses(
        'ui-button',

        `ui-button--${safeVariant}`,

        safeSize !== 'medium' &&
        `ui-button--${safeSize}`,

        iconOnly &&
        'ui-button--icon',

        fullWidth &&
        'ui-button--full-width',

        className
      )}

      // هنگام بارگذاری نیز دکمه غیرفعال باشد
      disabled={disabled || loading}

      // اگر loading فعال است مقدار true ثبت شود؛
      // در غیر این صورت مقدار ارسالی از بیرون حفظ شود.
      aria-busy={loading ? true : ariaBusy}
    >

      {/* آیکون ابتدای متن */}
      {startIcon !== null && startIcon !== undefined && (
        <span
          className="ui-button__start-icon"
          aria-hidden="true"
        >
          {startIcon}
        </span>
      )}


      {/* متن یا محتوای اصلی دکمه */}
      {children}


      {/* آیکون انتهای متن */}
      {endIcon !== null && endIcon !== undefined && (
        <span
          className="ui-button__end-icon"
          aria-hidden="true"
        >
          {endIcon}
        </span>
      )}

    </button>
  );
});


export default Button;