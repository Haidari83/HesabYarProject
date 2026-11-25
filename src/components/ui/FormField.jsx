import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useId,
} from 'react';


// =============================================
// ابزارهای عمومی FormField
// =============================================


// ترکیب کلاس‌های CSS و حذف مقدارهای خالی و تکراری
function joinClasses(...values) {
  return [...new Set(
    values.filter(Boolean)
  )].join(' ');
}


// نوع ورودی‌هایی که نباید ظاهر عمومی فیلد را بگیرند
const UNSUPPORTED_INPUT_TYPES = new Set([
  'hidden',
  'checkbox',
  'radio',
  'file',
  'range',
  'color',
  'button',
  'submit',
  'reset',
  'image',
]);


// تشخیص کنترل استاندارد و قابل پشتیبانی فرم
function isSupportedControl(element) {

  // فقط عناصر HTML را بررسی می‌کنیم، نه کامپوننت‌های React.
  if (
    !isValidElement(element) ||
    typeof element.type !== 'string'
  ) {
    return false;
  }


  // ورودی، فهرست انتخابی یا فیلد چندخطی
  if (
    !['input', 'select', 'textarea'].includes(element.type)
  ) {
    return false;
  }


  // ورودی‌های خاص مانند checkbox و file از این کامپوننت استفاده نمی‌کنند.
  if (element.type === 'input') {

    const inputType = String(
      element.props.type || 'text'
    ).toLowerCase();

    if (UNSUPPORTED_INPUT_TYPES.has(inputType)) {
      return false;
    }

  }


  return true;
}


// پیدا کردن اولین کنترل واقعی، حتی اگر داخل یک wrapper باشد.
function findFirstControl(children) {

  let foundControl = null;


  function visit(nodes) {

    // پس از پیدا شدن کنترل اول، جست‌وجو متوقف می‌شود.
    if (foundControl) {
      return;
    }


    Children.forEach(nodes, (child) => {

      if (
        foundControl ||
        !isValidElement(child)
      ) {
        return;
      }


      // اگر خود عنصر یک کنترل معتبر باشد، آن را انتخاب می‌کنیم.
      if (isSupportedControl(child)) {

        foundControl = child;

        return;

      }


      // فقط داخل Fragment و عناصر HTML به دنبال ورودی می‌گردیم.
      // وارد ساختار داخلی کامپوننت‌های سفارشی React نمی‌شویم.
      if (
        child.type === Fragment ||
        typeof child.type === 'string'
      ) {

        visit(child.props.children);

      }

    });

  }


  visit(children);

  return foundControl;
}


// ادغام چند شناسه برای aria-describedby و حذف موارد تکراری
function mergeIdReferences(...values) {

  const ids = values
    .filter(Boolean)
    .flatMap((value) => String(value).split(/\s+/))
    .filter(Boolean);

  const uniqueIds = [...new Set(ids)];

  return uniqueIds.length > 0
    ? uniqueIds.join(' ')
    : undefined;
}


// اضافه کردن ویژگی‌های مشترک به اولین کنترل واقعی
function enhanceFirstControl(children, controlProps) {

  // فقط یک کنترل در هر FormField اصلاح می‌شود.
  let hasEnhanced = false;


  function visit(nodes) {

    return Children.map(nodes, (child) => {

      if (!isValidElement(child)) {
        return child;
      }


      // اولین ورودی معتبر را با ویژگی‌های مشترک تکمیل می‌کنیم.
      if (
        !hasEnhanced &&
        isSupportedControl(child)
      ) {

        hasEnhanced = true;

        return cloneElement(
          child,
          controlProps(child)
        );

      }


      // حفظ wrapperهای HTML و جست‌وجوی ورودی درون آن‌ها
      if (
        child.type === Fragment ||
        typeof child.type === 'string'
      ) {

        const enhancedNestedChildren = visit(
          child.props.children
        );

        return cloneElement(
          child,
          undefined,
          enhancedNestedChildren
        );

      }


      // کامپوننت‌های سفارشی و سایر عناصر بدون تغییر باقی می‌مانند.
      return child;

    });

  }


  return visit(children);
}


// =============================================
// کامپوننت عمومی فیلد فرم
// =============================================

function FormField({

  // شناسه کنترل واقعی فرم
  id,

  // شناسه مستقل محفظه بیرونی
  containerId,

  // متن یا محتوای برچسب
  label,

  // ضروری بودن مقدار
  required = false,

  // متن راهنمای فیلد
  hint,

  // پیام خطای اعتبارسنجی
  error,

  // اندازه فیلد
  size = 'medium',

  // کلاس محفظه اصلی
  className = '',

  // کلاس برچسب
  labelClassName = '',

  // کلاس کنترل واقعی
  controlClassName = '',

  // کلاس راهنما
  hintClassName = '',

  // کلاس پیام خطا
  errorClassName = '',

  // محتوای فیلد
  children,

  // سایر ویژگی‌های محفظه بیرونی
  ...containerProps

}) {

  // شناسه یکتا برای هر نمونه FormField
  const generatedId = useId().replace(/:/g, '');


  // پیدا کردن اولین ورودی معتبر در ساختار فرزندان
  const firstControl = findFirstControl(children);


  // اگر شناسه دستی تعیین نشده باشد، از شناسه ورودی استفاده می‌کنیم.
  const controlId =
    id ||
    firstControl?.props?.id ||
    `ui-field-${generatedId}`;


  // تشخیص وجود راهنما
  const hasHint =
    hint !== null &&
    hint !== undefined &&
    hint !== false &&
    hint !== '';


  // تشخیص وجود خطای معتبر
  const hasError =
    error !== null &&
    error !== undefined &&
    error !== false &&
    error !== '';


  // آیا برچسب قابل نمایش وجود دارد؟
  const hasLabel =
    label !== null &&
    label !== undefined &&
    label !== '';


  // شناسه راهنما
  const hintId = hasHint
    ? `${controlId}-hint`
    : undefined;


  // شناسه پیام خطا
  const errorId = hasError
    ? `${controlId}-error`
    : undefined;


  // آماده‌سازی ویژگی‌های مشترک برای ورودی
  const enhancedChildren = enhanceFirstControl(
    children,

    (child) => {

      // حفظ aria-describedby قبلی همراه راهنما و خطا
      const describedBy = mergeIdReferences(
        child.props['aria-describedby'],
        hintId,
        errorId
      );


      // کلاس‌های کنترل واقعی
      const controlClasses = joinClasses(
        child.props.className,
        'ui-field__control',

        // فیلد چندخطی به padding و ارتفاع جداگانه نیاز دارد.
        child.type === 'textarea' &&
        'ui-field__control--textarea',

        controlClassName
      );


      return {

        // شناسه کنترل واقعی
        id: controlId,

        // حفظ کلاس‌های قبلی و افزودن کلاس مشترک
        className: controlClasses,

        // ضروری بودن ورودی
        required: Boolean(
          required || child.props.required
        ),

        // نمایش وضعیت خطا برای فناوری‌های کمکی
        'aria-invalid': hasError
          ? true
          : child.props['aria-invalid'],

        // اتصال راهنما و پیام خطا به ورودی
        'aria-describedby': describedBy,

        // معرفی مستقل عنصر حاوی خطا
        'aria-errormessage': hasError
          ? errorId
          : child.props['aria-errormessage'],

      };

    }
  );


  // اندازه مجاز فیلد
  const safeSize = ['small', 'large'].includes(size)
    ? size
    : '';


  return (

    <div
      // شناسه محفظه بیرونی
      id={containerId}

      // کلاس‌های عمومی و اختصاصی
      className={joinClasses(
        'ui-field',
        safeSize && `ui-field--${safeSize}`,
        hasError && 'ui-field--invalid',
        className
      )}

      // ویژگی‌های دیگر محفظه
      {...containerProps}
    >

      {/* برچسب فیلد */}
      {hasLabel && (

        <label
          className={joinClasses(
            'ui-field__label',
            labelClassName
          )}

          // اتصال برچسب به ورودی واقعی
          htmlFor={firstControl ? controlId : undefined}
        >

          {label}

          {/* علامت ضروری بودن فیلد */}
          {required && (
            <span
              className="ui-field__required"
              aria-hidden="true"
            >
              *
            </span>
          )}

        </label>

      )}


      {/* کنترل اصلی؛ حتی اگر داخل wrapper باشد */}
      {enhancedChildren}


      {/* متن راهنمای فیلد */}
      {hasHint && (

        <small
          id={hintId}
          className={joinClasses(
            'ui-field__hint',
            hintClassName
          )}
        >
          {hint}
        </small>

      )}


      {/* پیام خطای فیلد */}
      {hasError && (

        <small
          id={errorId}
          className={joinClasses(
            'ui-field__error',
            errorClassName
          )}
          role="alert"
        >
          {error}
        </small>

      )}

    </div>

  );

}


export default FormField;