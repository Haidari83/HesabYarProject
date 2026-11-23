// ارقام فارسی و عربی برای تبدیل به ارقام انگلیسی
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';


// یکسان‌سازی متن فارسی برای جست‌وجو و مقایسه
export function normalizePersianText(value, options = {}) {

  const {
    removeDiacritics = true,
  } = options ?? {};


  let normalizedText = String(value ?? '')
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک');


  // حذف حرکات و کشیده در صورت نیاز
  if (removeDiacritics) {

    normalizedText = normalizedText.replace(
      /[\u064B-\u065F\u0670\u0640]/g,
      ''
    );

  }


  return normalizedText
    .replace(/[\u200c\u200d]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

}


// تبدیل ارقام فارسی و عربی به انگلیسی
export function toEnglishDigits(value) {

  return String(value ?? '')
    .replace(/[۰-۹]/g, (digit) =>
      String(PERSIAN_DIGITS.indexOf(digit))
    )
    .replace(/[٠-٩]/g, (digit) =>
      String(ARABIC_DIGITS.indexOf(digit))
    );

}


// تبدیل ارقام انگلیسی به فارسی
export function toPersianDigits(value) {

  return toEnglishDigits(value).replace(
    /\d/g,
    (digit) => PERSIAN_DIGITS[Number(digit)]
  );

}