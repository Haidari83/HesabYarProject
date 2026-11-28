import { readSheet } from 'read-excel-file/browser';

import { normalizePersianText } from './persianText';

// حداکثر حجم مجاز فایل‌های Excel
export const MAX_EXCEL_FILE_SIZE = 10 * 1024 * 1024;

// تبدیل مقدار سلول به متن قابل استفاده
export function getExcelCellText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

// نمایش خوانای حجم فایل
export function formatExcelFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} بایت`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} کیلوبایت`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} مگابایت`;
}

// خواندن برگه اول فایل Excel با کنترل‌های مشترک
export async function readExcelSheet(file) {
  if (!file || typeof file.name !== 'string') {
    throw new Error('فایل انتخاب‌شده معتبر نیست.');
  }

  // در این نسخه فقط فایل XLSX پذیرفته می‌شود.
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error(
      'فرمت فایل معتبر نیست. لطفاً فایل را با فرمت XLSX انتخاب کن.'
    );
  }

  // جلوگیری از خواندن فایل‌های بسیار بزرگ
  if (file.size > MAX_EXCEL_FILE_SIZE) {
    throw new Error(
      'حجم فایل نمی‌تواند بیشتر از ۱۰ مگابایت باشد.'
    );
  }

  // خواندن برگه اول فایل
  const rows = await readSheet(file);

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(
      'فایل Excel خالی است یا اطلاعات قابل خواندن ندارد.'
    );
  }

  return rows;
}

// پیدا کردن جایگاه ستون‌ها بر اساس عنوان و نام‌های جایگزین
export function resolveExcelColumnIndexes(headerRow, columns) {
  if (!Array.isArray(headerRow) || !Array.isArray(columns)) {
    throw new Error('ساختار عنوان ستون‌های فایل معتبر نیست.');
  }

  const columnIndexes = {};
  const missingColumns = [];

  for (const column of columns) {
    const aliases = column.aliases.map((alias) =>
      normalizePersianText(alias, {
        removeDiacritics: false,
      })
    );

    const matchedIndexes = headerRow
      .map((cell, index) => ({
        index,
        header: normalizePersianText(cell, {
          removeDiacritics: false,
        }),
      }))
      .filter((item) => aliases.includes(item.header))
      .map((item) => item.index);

    // جلوگیری از تعریف چند ستون با یک مفهوم
    if (matchedIndexes.length > 1) {
      throw new Error(
        `ستون «${column.label}» بیش از یک بار در فایل تعریف شده است.`
      );
    }

    columnIndexes[column.key] =
      matchedIndexes.length > 0
        ? matchedIndexes[0]
        : -1;

    // جمع‌آوری ستون‌های الزامی که وجود ندارند
    if (column.required && matchedIndexes.length === 0) {
      missingColumns.push(column.label);
    }
  }

  if (missingColumns.length > 0) {
    throw new Error(
      `ستون‌های الزامی پیدا نشدند: ${missingColumns.join('، ')}`
    );
  }

  return columnIndexes;
}