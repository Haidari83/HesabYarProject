import DateObject from 'react-date-object';

import persianCalendar from 'react-date-object/calendars/persian';
import gregorianCalendar from 'react-date-object/calendars/gregorian';

import gregorianEnglish from 'react-date-object/locales/gregorian_en';

import persianAfghanistan from '../locales/persianAfghanistan';


// منطقه زمانی رسمی برنامه
export const APP_TIME_ZONE = 'Asia/Kabul';


// دریافت تاریخ امروز به شکل میلادی استاندارد
export function getTodayGregorianDate(now = new Date()) {

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);


  const values = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ])
  );


  return `${values.year}-${values.month}-${values.day}`;

}


// تبدیل تاریخ میلادی به تاریخ شمسی
export function toPersianDate(gregorianDate) {

  if (!gregorianDate) {
    return null;
  }


  return new DateObject({
    date: gregorianDate,
    format: 'YYYY-MM-DD',
  }).convert(
    persianCalendar,
    persianAfghanistan
  );

}


// تبدیل تاریخ شمسی به تاریخ میلادی
export function toGregorianDate(selectedDate) {

  if (!selectedDate) {
    return '';
  }


  return new DateObject(selectedDate)
    .convert(
      gregorianCalendar,
      gregorianEnglish
    )
    .format('YYYY-MM-DD');

}


// نمایش تاریخ میلادی در قالب شمسی
export function formatPersianDate(
  gregorianDate,
  format = 'DD MMMM YYYY',
  emptyValue = '—'
) {

  const persianDate = toPersianDate(gregorianDate);


  if (!persianDate) {
    return emptyValue;
  }


  return persianDate.format(format);

}


// قالب‌بندی تاریخ با منطقه زمانی تعیین‌شده
export function formatDateInTimeZone(
  value,
  options = {}
) {

  const {
    locale = 'fa-AF',
    timeZone = APP_TIME_ZONE,
    emptyValue = '—',
    ...formatOptions
  } = options ?? {};


  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return emptyValue;
  }


  const date = value instanceof Date
    ? value
    : value instanceof DateObject
      ? value.toDate()
      : new Date(value);


  if (Number.isNaN(date.getTime())) {
    return emptyValue;
  }


  return new Intl.DateTimeFormat(
    locale,
    {
      ...formatOptions,
      timeZone,
    }
  ).format(date);

}