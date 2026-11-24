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

  // اگر کنترل از قبل شناسه داشته باشد همان را نگه می‌داریم.
  const firstControl = childList.find(
    (child) => isValidElement(child) && child.type !== Fragment
  );

  const controlId =
    id || firstControl?.props?.id || `ui-field-${generatedId}`;

  const hintId = hint !== null && hint !== undefined
    ? `${controlId}-hint`
    : undefined;

  const hasError = error !== null && error !== undefined && error !== '';

  const errorId = hasError
    ? `${controlId}-error`
    : undefined;

  let controlDecorated = false;

  const enhancedChildren = Children.map(children, (child) => {
    if (
      !isValidElement(child) ||
      child.type === Fragment ||
      controlDecorated
    ) {
      return child;
    }

    controlDecorated = true;

    const existingDescription = child.props['aria-describedby'];
    const describedBy = [
      existingDescription,
      hintId,
      errorId,
    ].filter(Boolean).join(' ');

    return cloneElement(child, {
      id: child.props.id || controlId,
      className: joinClasses(
        'ui-field__control',
        controlClassName,
        child.props.className
      ),
      'aria-invalid': hasError ? true : child.props['aria-invalid'],
      'aria-describedby': describedBy || undefined,
      required: required ? child.props.required ?? true : child.props.required,
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
