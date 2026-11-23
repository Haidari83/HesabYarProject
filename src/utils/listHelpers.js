// ساخت چند ردیف با استفاده از تابع سازنده مخصوص هر ردیف
export function createRows(count, createRow) {

  if (typeof createRow !== 'function') {
    throw new TypeError(
      'تابع سازنده ردیف معتبر نیست.'
    );
  }


  const requestedCount = Number(count);


  // جلوگیری از تعداد نامعتبر یا منفی
  if (
    !Number.isFinite(requestedCount) ||
    requestedCount <= 0
  ) {
    return [];
  }


  // تبدیل تعداد به عدد صحیح
  const rowCount = Math.floor(requestedCount);


  if (!Number.isSafeInteger(rowCount)) {
    return [];
  }


  // هر بار تابع سازنده اجرا می‌شود تا ردیف مستقل ساخته شود.
  return Array.from(
    { length: rowCount },
    () => createRow()
  );

}