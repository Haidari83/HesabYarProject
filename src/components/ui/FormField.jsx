import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useId,
} from 'react';

// فیلد عمومی فرم؛ برچسب، کنترل، راهنما و خطا را به هم متصل می‌کند.
function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

function FormField({
  id,
  label,
  required = false,
  hint,
  error,
  size = 'medium',
  className = '',
  labelClassName = '',
  controlClassName = '',
  hintClassName = '',
  errorClassName = '',
  children,
  ...containerProps
}) {
  const generatedId = useId().replace(/:/g, '');

  const childList = Children.toArray(children);

  // پیدا کردن موقعیت اولین کنترل معتبر در میان فرزندان
  const firstControlIndex = childList.findIndex(
    (child) => isValidElement(child) && child.type !== Fragment
  );

  const firstControl =
    firstControlIndex >= 0
      ? childList[firstControlIndex]
      : null;

  // اگر کنترل از قبل شناسه داشته باشد همان شناسه حفظ می‌شود،
  // مگر اینکه شناسه مستقلی از طریق FormField تعیین شده باشد.
  const controlId =
    id || firstControl?.props?.id || `ui-field-${generatedId}`;

  const hintId =
    hint !== null && hint !== undefined
      ? `${controlId}-hint`
      : undefined;

  const hasError =
    error !== null && error !== undefined && error !== '';

  const errorId = hasError
    ? `${controlId}-error`
    : undefined;

  // فقط اولین کنترل معتبر را با ویژگی‌های عمومی فرم تکمیل می‌کنیم.
  const enhancedChildren = childList.map((child, index) => {
    if (
      index !== firstControlIndex ||
      !isValidElement(child) ||
      child.type === Fragment
    ) {
      return child;
    }

    const existingDescription = child.props['aria-describedby'];

    const describedBy = [
      existingDescription,
      hintId,
      errorId,
    ]
      .filter(Boolean)
      .join(' ');

    return cloneElement(child, {
      id: controlId,
      className: joinClasses(
        'ui-field__control',
        controlClassName,
        child.props.className
      ),
      'aria-invalid': hasError
        ? true
        : child.props['aria-invalid'],
      'aria-describedby': describedBy || undefined,
      required: required || child.props.required,
    });
  });

  const safeSize = ['small', 'large'].includes(size) ? size : '';

  return (
    <div
      className={joinClasses(
        'ui-field',
        safeSize && `ui-field--${safeSize}`,
        hasError && 'ui-field--invalid',
        className
      )}
      {...containerProps}
    >
      {label !== null && label !== undefined && (
        <label
          className={joinClasses(
            'ui-field__label',
            labelClassName
          )}
          htmlFor={controlId}
        >
          {label}
          {required && (
            <span className="ui-field__required" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {enhancedChildren}

      {hint !== null && hint !== undefined && (
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
