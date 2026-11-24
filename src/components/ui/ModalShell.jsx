import {
  forwardRef,
  useEffect,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';

import Button from './Button';

// عناصر تعاملی که باید در چرخه فوکوس مودال باقی بمانند.
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const SIZE_CLASSES = {
  small: 'ui-modal--small',
  medium: 'ui-modal--medium',
  large: 'ui-modal--large',
  'extra-large': 'ui-modal--extra-large',
  wide: 'ui-modal--wide',
};

// شمارنده مانع می‌شود که بسته‌شدن یک مودال، قفل اسکرول مودال دیگر را بردارد.
let activeScrollLocks = 0;
let previousBodyOverflow = '';

function acquireBodyScrollLock() {
  if (typeof document === 'undefined') {
    return () => { };
  }

  if (activeScrollLocks === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  activeScrollLocks += 1;

  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    activeScrollLocks = Math.max(0, activeScrollLocks - 1);

    if (activeScrollLocks === 0) {
      document.body.style.overflow = previousBodyOverflow;
      previousBodyOverflow = '';
    }
  };
}

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

function assignRef(ref, value) {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
}

const ModalShell = forwardRef(function ModalShell({
  open = false,
  onClose,
  children,
  size = 'medium',
  className = '',
  backdropClassName = '',
  role = 'dialog',
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  closeOnBackdrop = true,
  closeOnEscape = true,
  closeDisabled = false,
  lockScroll = true,
  restoreFocus = true,
  initialFocusRef,
  portal = true,
  portalTarget,
  priority = false,
  inset10 = false,
  fixedHeight = false,
  selfScroll = false,
  animated = false,
  mobileSheet = false,
  dir = 'rtl',
  tabIndex = -1,
  style,
  backdropStyle,
  id,
}, forwardedRef) {
  const dialogRef = useRef(null);

  // فوکوس هنگام بازشدن به کنترل اولیه یا نخستین کنترل قابل استفاده منتقل می‌شود.
  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return undefined;
    }

    const previouslyFocused = document.activeElement;
    const releaseScrollLock = lockScroll
      ? acquireBodyScrollLock()
      : null;

    const focusTarget =
      initialFocusRef?.current ||
      dialogRef.current?.querySelector(FOCUSABLE_SELECTOR) ||
      dialogRef.current;

    focusTarget?.focus?.();

    return () => {
      releaseScrollLock?.();

      if (
        restoreFocus &&
        previouslyFocused &&
        document.contains(previouslyFocused)
      ) {
        previouslyFocused.focus?.();
      }
    };
  }, [open, lockScroll, restoreFocus, initialFocusRef]);

  if (!open) {
    return null;
  }

  function handleDialogRef(element) {
    dialogRef.current = element;
    assignRef(forwardedRef, element);
  }

  function handleDialogKeyDown(event) {
    if (event.key === 'Escape' && closeOnEscape && !closeDisabled) {
      event.preventDefault();
      event.stopPropagation();
      onClose?.();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    const focusableElements = Array.from(
      dialog.querySelectorAll(FOCUSABLE_SELECTOR)
    ).filter((element) => (
      !element.hasAttribute('disabled') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      (element.offsetWidth > 0 ||
        element.offsetHeight > 0 ||
        element.getClientRects().length > 0)
    ));

    if (focusableElements.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;
    const focusIsInside = dialog.contains(activeElement);

    if (event.shiftKey && (!focusIsInside || activeElement === firstElement)) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && (!focusIsInside || activeElement === lastElement)) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  function handleBackdropMouseDown(event) {
    if (
      event.target === event.currentTarget &&
      closeOnBackdrop &&
      !closeDisabled
    ) {
      onClose?.();
    }
  }

  const dialogClasses = joinClasses(
    'ui-modal',
    SIZE_CLASSES[size],
    fixedHeight && 'ui-modal--fixed-height',
    selfScroll && 'ui-modal--self-scroll',
    animated && 'ui-modal--animated',
    className
  );

  const backdropClasses = joinClasses(
    'ui-modal-backdrop',
    priority && 'ui-modal-backdrop--priority',
    inset10 && 'ui-modal-backdrop--inset-10',
    mobileSheet && 'ui-modal-backdrop--mobile-sheet',
    backdropClassName
  );

  const modalElement = (
    <div
      className={backdropClasses}
      style={backdropStyle}
      onMouseDown={handleBackdropMouseDown}
    >
      <section
        ref={handleDialogRef}
        id={id}
        className={dialogClasses}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        tabIndex={tabIndex}
        dir={dir}
        style={style}
        onKeyDown={handleDialogKeyDown}
      >
        {children}
      </section>
    </div>
  );

  if (portal && typeof document !== 'undefined') {
    return createPortal(
      modalElement,
      portalTarget || document.body
    );
  }

  return modalElement;
});

// سربرگ استاندارد مودال؛ دکمه بستن در صورت ارائه onClose نمایش داده می‌شود.
function ModalHeader({
  title,
  titleId,
  description,
  descriptionId,
  eyebrow,
  onClose,
  closeDisabled = false,
  closeLabel = 'بستن پنجره',
  children,
  className = '',
}) {
  return (
    <header className={joinClasses('ui-modal__header', className)}>
      <div className="ui-modal__heading">
        {eyebrow && (
          <span className="ui-modal__eyebrow">{eyebrow}</span>
        )}

        {title && (
          <h2 id={titleId} className="ui-modal__title">
            {title}
          </h2>
        )}

        {description && (
          <p id={descriptionId} className="ui-modal__description">
            {description}
          </p>
        )}

        {children}
      </div>

      {typeof onClose === 'function' && (
        <ModalCloseButton
          onClick={onClose}
          disabled={closeDisabled}
          ariaLabel={closeLabel}
        />
      )}
    </header>
  );
}

// بدنه مودال با امکان فعال‌کردن اسکرول و فاصله داخلی مشترک.
function ModalBody({
  children,
  scrollable = false,
  padded = false,
  className = '',
  as: BodyElement = 'div',
  ...bodyProps
}) {
  return (
    <BodyElement
      className={joinClasses(
        'ui-modal__body',
        scrollable && 'ui-modal__body--scroll',
        padded && 'ui-modal__body--padded',
        className
      )}
      {...bodyProps}
    >
      {children}
    </BodyElement>
  );
}

// پایین مودال برای دکمه‌ها و عملیات پایانی.
function ModalFooter({
  children,
  fullWidth = false,
  stackOnMobile = false,
  className = '',
  as: FooterElement = 'footer',
  ...footerProps
}) {
  return (
    <FooterElement
      className={joinClasses(
        'ui-modal__footer',
        fullWidth && 'ui-modal__footer--full-width',
        stackOnMobile && 'ui-modal__footer--stack-mobile',
        className
      )}
      {...footerProps}
    >
      {children}
    </FooterElement>
  );
}

// دکمه بستن مشترک که در Header و خارج از آن قابل استفاده است.
// دکمه مشترک بستن پنجره‌ها با استفاده از Button مرکزی
function ModalCloseButton({
  onClick,
  disabled = false,
  ariaLabel = 'بستن پنجره',
  className = '',
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="small"
      iconOnly
      className={joinClasses(
        'ui-modal__close',
        className
      )}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      ×
    </Button>
  );
}
ModalShell.Header = ModalHeader;
ModalShell.Body = ModalBody;
ModalShell.Footer = ModalFooter;
ModalShell.CloseButton = ModalCloseButton;

export {
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
};

export default ModalShell;
