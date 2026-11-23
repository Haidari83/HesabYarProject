// قالب‌بندی عمومی اعداد در برنامه
export function formatNumber(value, options = {}) {

  const {
    locale = 'fa-IR',
    maximumFractionDigits = 2,
    minimumFractionDigits,
    emptyValue = '—',
    invalidValue = '—',
  } = options ?? {};


  // تنظیمات قالب‌بندی عدد
  const numberOptions = {};


  if (
    maximumFractionDigits !== null &&
    maximumFractionDigits !== undefined
  ) {
    numberOptions.maximumFractionDigits =
      maximumFractionDigits;
  }


  if (
    minimumFractionDigits !== null &&
    minimumFractionDigits !== undefined
  ) {
    numberOptions.minimumFractionDigits =
      minimumFractionDigits;
  }


  const formatter = new Intl.NumberFormat(
    locale,
    numberOptions
  );


  // قالب‌بندی مقدار جایگزین
  function formatFallback(fallback) {

    // اگر مقدار جایگزین عدد باشد، آن را با ارقام مناسب نمایش می‌دهیم.
    if (
      typeof fallback === 'number' &&
      Number.isFinite(fallback)
    ) {
      return formatter.format(fallback);
    }

    return String(fallback ?? '');

  }


  // مدیریت مقدارهای خالی
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return formatFallback(emptyValue);
  }


  const number = Number(value);


  // جلوگیری از نمایش مقدارهای عددی نامعتبر
  if (!Number.isFinite(number)) {
    return formatFallback(invalidValue);
  }


  return formatter.format(number);

}