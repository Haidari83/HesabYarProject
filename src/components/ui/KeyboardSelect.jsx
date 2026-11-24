import { useCallback, useEffect, useId, useRef, useState } from 'react';

// مقدار و عنوان پیش‌فرض هر گزینه از ویژگی‌های value و label خوانده می‌شود.
const defaultGetOptionValue = (option) => option?.value;
const defaultGetOptionLabel = (option) => option?.label ?? '';

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

function getFirstEnabledIndex(options) {
  return options.findIndex((option) => !option?.disabled);
}

function getLastEnabledIndex(options) {
  for (let index = options.length - 1; index >= 0; index -= 1) {
    if (!options[index]?.disabled) {
      return index;
    }
  }

  return -1;
}

// پیدا کردن گزینه بعدی فعال با حرکت چرخشی در فهرست
function getNextEnabledIndex(options, currentIndex, direction) {
  if (options.length === 0) {
    return -1;
  }

  for (let step = 1; step <= options.length; step += 1) {
    const nextIndex =
      (currentIndex + direction * step + options.length) % options.length;

    if (!options[nextIndex]?.disabled) {
      return nextIndex;
    }
  }

  return -1;
}

function KeyboardSelect({
  options = [],
  value,
  onChange,
  ariaLabel,
  labelledBy,
  placeholder = 'انتخاب کنید',
  disabled = false,
  className = '',
  triggerClassName = '',
  arrowClassName = '',
  optionsClassName = '',
  optionClassName = '',
  optionsRole = 'listbox',
  optionRole = 'option',
  ariaHasPopup,
  selectedAttribute = 'aria-selected',
  renderValue,
  renderOption,
  emptyMessage = 'گزینه‌ای برای نمایش وجود ندارد',
  arrow,
  closeOnSelect = true,
  onOpenChange,
  getOptionValue = defaultGetOptionValue,
  getOptionLabel = defaultGetOptionLabel,
}) {
  const generatedId = useId();
  const listboxId = `${generatedId}-options`;


  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // نگهداری مقدار قبلی disabled برای تشخیص تغییر آن
  const [previousDisabled, setPreviousDisabled] = useState(disabled);

  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);

  // این دو ref برای تشخیص بسته‌شدن انتخاب‌گر استفاده می‌شوند.
  const previousDisabledRef = useRef(disabled);
  const wasOpenRef = useRef(false);

  // اگر انتخاب‌گر هنگام بازبودن غیرفعال شود، همان‌جا بسته می‌شود.
  if (disabled !== previousDisabled) {
    setPreviousDisabled(disabled);

    if (disabled && isOpen) {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }


  const selectedIndex = options.findIndex(
    (option) => getOptionValue(option) === value
  );

  const selectedOption =
    selectedIndex >= 0 ? options[selectedIndex] : null;

  // تغییر وضعیت باز بودن فهرست از یک مسیر انجام می‌شود.

  const updateOpenState = useCallback((nextValue) => {
    const nextOpenState = Boolean(nextValue) && !disabled;

    // اگر وضعیت جدید با وضعیت فعلی تفاوتی ندارد، کاری انجام نمی‌دهیم.
    if (wasOpenRef.current === nextOpenState) {
      return;
    }

    wasOpenRef.current = nextOpenState;

    setIsOpen(nextOpenState);
    onOpenChange?.(nextOpenState);
  }, [disabled, onOpenChange]);


  // پس از بازشدن فهرست، گزینه فعال دریافت‌کننده فوکوس می‌شود.
  useEffect(() => {
    if (isOpen && activeIndex >= 0) {
      optionRefs.current[activeIndex]?.focus();
    }
  }, [isOpen, activeIndex]);

  // کلیک بیرون از انتخاب‌گر باعث بسته‌شدن فهرست می‌شود.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleOutsideMouseDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        updateOpenState(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideMouseDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideMouseDown);
    };
  }, [isOpen, updateOpenState]);


  // هماهنگ‌سازی تغییر disabled با وضعیت داخلی انتخاب‌گر
  useEffect(() => {
    if (
      disabled &&
      !previousDisabledRef.current &&
      wasOpenRef.current
    ) {
      // ثبت بسته‌شدن انتخاب‌گر
      wasOpenRef.current = false;

      // اطلاع به کامپوننت والد
      onOpenChange?.(false);
    }

    // نگهداری وضعیت فعلی disabled برای بررسی تغییر بعدی
    previousDisabledRef.current = disabled;
  }, [disabled, onOpenChange]);


  function openPicker() {
    const nextIndex =
      selectedIndex >= 0 && !options[selectedIndex]?.disabled
        ? selectedIndex
        : getFirstEnabledIndex(options);

    setActiveIndex(nextIndex);
    updateOpenState(true);
  }

  function closePicker({ restoreFocus = false } = {}) {
    updateOpenState(false);

    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }

  function selectOption(option, index) {
    if (!option || option.disabled) {
      return;
    }

    onChange?.(getOptionValue(option), option);
    setActiveIndex(index);

    if (closeOnSelect) {
      closePicker({ restoreFocus: true });
    }
  }

  function handleTriggerKeyDown(event) {
    if (disabled) {
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();

      if (!isOpen) {
        openPicker();
      } else {
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        const nextIndex = getNextEnabledIndex(
          options,
          activeIndex,
          direction
        );

        setActiveIndex(nextIndex);
      }
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      closePicker();
    }
  }


  function handleOptionKeyDown(event, index) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex(getNextEnabledIndex(options, index, 1));
        return;

      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex(getNextEnabledIndex(options, index, -1));
        return;

      case 'Home':
        event.preventDefault();
        setActiveIndex(getFirstEnabledIndex(options));
        return;

      case 'End':
        event.preventDefault();
        setActiveIndex(getLastEnabledIndex(options));
        return;

      case 'Escape':
        event.preventDefault();
        closePicker({ restoreFocus: true });
        return;

      case ' ':
      case 'Enter':
        event.preventDefault();
        selectOption(options[index], index);
        return;

      default:
        return;
    }
  }


  const selectedValue = selectedOption
    ? renderValue
      ? renderValue(selectedOption)
      : getOptionLabel(selectedOption)
    : placeholder;

  return (
    <div
      ref={containerRef}
      className={joinClasses('ui-keyboard-select', className)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          updateOpenState(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={joinClasses(
          'ui-keyboard-select__trigger',
          triggerClassName
        )}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        aria-haspopup={
          ariaHasPopup ??
          (optionsRole === 'listbox' ? 'listbox' : undefined)
        }
        aria-expanded={isOpen}
        aria-controls={listboxId}
        onClick={() => {
          if (isOpen) {
            closePicker();
          } else {
            openPicker();
          }
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="ui-keyboard-select__value">
          {selectedValue}
        </span>

        <span
          className={joinClasses(
            'ui-keyboard-select__arrow',
            arrowClassName
          )}
          aria-hidden="true"
        >
          {arrow ?? (isOpen ? '⌃' : '⌄')}
        </span>
      </button>

      {isOpen && (
        <div
          id={listboxId}
          className={joinClasses(
            'ui-keyboard-select__options',
            optionsClassName
          )}
          role={optionsRole}
          aria-label={ariaLabel}
        >
          {options.length > 0 ? (
            options.map((option, index) => {
              const isSelected = getOptionValue(option) === value;
              const isActive = activeIndex === index;
              const selectionProps =
                selectedAttribute === 'aria-pressed'
                  ? { 'aria-pressed': isSelected }
                  : { 'aria-selected': isSelected };

              return (
                <button
                  key={String(getOptionValue(option) ?? index)}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  type="button"
                  role={optionRole}
                  className={joinClasses(
                    'ui-keyboard-select__option',
                    optionClassName
                  )}
                  disabled={Boolean(option?.disabled)}
                  tabIndex={-1}
                  data-active={isActive ? 'true' : undefined}
                  {...selectionProps}
                  onClick={() => selectOption(option, index)}
                  onKeyDown={(event) => handleOptionKeyDown(event, index)}
                >
                  {renderOption
                    ? renderOption(option, {
                      selected: isSelected,
                      active: isActive,
                    })
                    : (
                      <>
                        <span>{getOptionLabel(option)}</span>
                        {isSelected && (
                          <span aria-hidden="true">✓</span>
                        )}
                      </>
                    )}
                </button>
              );
            })
          ) : (
            <div className="ui-keyboard-select__empty" role="status">
              {emptyMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default KeyboardSelect;
