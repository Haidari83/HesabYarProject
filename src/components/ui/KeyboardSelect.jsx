import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { normalizePersianText } from '../../utils/persianText';
import { joinClasses } from '../../utils/joinClasses';
// مقدار و عنوان پیش‌فرض هر گزینه از ویژگی‌های value و label خوانده می‌شود.
const defaultGetOptionValue = (option) => option?.value;
const defaultGetOptionLabel = (option) => option?.label ?? '';

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

// پیدا کردن گزینه‌ای که عنوان آن با عبارت تایپ‌شده شروع می‌شود
function findTypeaheadIndex(
  options,
  query,
  currentIndex,
  getOptionLabel,
  startAfterCurrent
) {
  if (!query || options.length === 0) {
    return -1;
  }

  const startIndex = currentIndex >= 0
    ? (
      startAfterCurrent
        ? (currentIndex + 1) % options.length
        : currentIndex
    )
    : 0;

  for (let step = 0; step < options.length; step += 1) {
    const index = (startIndex + step) % options.length;
    const option = options[index];

    if (option?.disabled) {
      continue;
    }

    const label = normalizePersianText(
      getOptionLabel(option)
    );

    if (label.startsWith(query)) {
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

  // نگهداری حروفی که کاربر برای جست‌وجو تایپ می‌کند
  const typeaheadBufferRef = useRef('');

  // نگهداری تایمر پاک‌شدن عبارت جست‌وجو
  const typeaheadTimerRef = useRef(null);

  // پاک‌سازی تایمر هنگام حذف کامپوننت
  useEffect(() => {
    return () => {
      if (typeaheadTimerRef.current !== null) {
        clearTimeout(typeaheadTimerRef.current);
      }
    };
  }, []);

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

  const closePicker = useCallback(
    ({ restoreFocus = false } = {}) => {
      updateOpenState(false);

      // پاک‌کردن عبارت جست‌وجوی قبلی
      typeaheadBufferRef.current = '';

      // توقف تایمر قبلی
      if (typeaheadTimerRef.current !== null) {
        clearTimeout(typeaheadTimerRef.current);
        typeaheadTimerRef.current = null;
      }

      // بازگرداندن فوکوس به دکمه اصلی
      if (restoreFocus) {
        triggerRef.current?.focus();
      }
    },
    [updateOpenState]
  );

  function openPicker() {
    const nextIndex =
      selectedIndex >= 0 && !options[selectedIndex]?.disabled
        ? selectedIndex
        : getFirstEnabledIndex(options);

    setActiveIndex(nextIndex);
    updateOpenState(true);
  }
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
        closePicker();
      }
    }

    document.addEventListener('mousedown', handleOutsideMouseDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideMouseDown);
    };
  }, [isOpen, closePicker]);


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

  function getTypeaheadMatch(event, currentIndex) {
    const key = event.key;

    // کلیدهای ترکیبی و کلیدهای غیرقابل چاپ را نادیده بگیر
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      key.length !== 1
    ) {
      return null;
    }

    // اگر فاصله اولین کلید باشد، رفتار انتخاب با Space حفظ شود.
    if (key === ' ' && !typeaheadBufferRef.current) {
      return null;
    }

    event.preventDefault();

    const normalizedKey = normalizePersianText(key);

    if (!normalizedKey) {
      return { index: -1 };
    }

    const previousBuffer = typeaheadBufferRef.current;

    // تشخیص تکرار یک حرف برای جابه‌جایی میان گزینه‌های مشابه
    const isRepeatedCharacter =
      previousBuffer.length > 0 &&
      Array.from(previousBuffer).every(
        (character) => character === normalizedKey
      );

    // اگر همان حرف تکرار شد، جست‌وجو از گزینه بعدی آغاز شود.
    // در غیر این صورت، حرف جدید به عبارت قبلی اضافه شود.
    const query = isRepeatedCharacter
      ? normalizedKey
      : previousBuffer + normalizedKey;

    typeaheadBufferRef.current = query;

    // تایمر قبلی را پاک کن
    if (typeaheadTimerRef.current !== null) {
      clearTimeout(typeaheadTimerRef.current);
    }

    // پس از ۷۰۰ میلی‌ثانیه عبارت جست‌وجو پاک شود
    typeaheadTimerRef.current = setTimeout(() => {
      typeaheadBufferRef.current = '';
      typeaheadTimerRef.current = null;
    }, 700);

    const matchedIndex = findTypeaheadIndex(
      options,
      query,
      currentIndex,
      getOptionLabel,
      previousBuffer.length === 0 || isRepeatedCharacter
    );

    return { index: matchedIndex };
  }

  function handleTriggerKeyDown(event) {
    if (disabled) {
      return;
    }

    // بررسی تایپ حروف برای جست‌وجوی سریع
    const typeaheadResult = getTypeaheadMatch(
      event,
      selectedIndex
    );

    if (typeaheadResult !== null) {
      if (typeaheadResult.index >= 0) {
        setActiveIndex(typeaheadResult.index);
        updateOpenState(true);
      }

      return;
    }

    if (
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp'
    ) {
      event.preventDefault();

      if (!isOpen) {
        openPicker();
      } else {
        const direction =
          event.key === 'ArrowDown' ? 1 : -1;

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

    // بررسی تایپ حروف برای جست‌وجوی سریع
    const typeaheadResult = getTypeaheadMatch(
      event,
      index
    );

    if (typeaheadResult !== null) {
      if (typeaheadResult.index >= 0) {
        setActiveIndex(typeaheadResult.index);
      }

      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex(
          getNextEnabledIndex(options, index, 1)
        );
        return;

      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex(
          getNextEnabledIndex(options, index, -1)
        );
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
          closePicker();
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
