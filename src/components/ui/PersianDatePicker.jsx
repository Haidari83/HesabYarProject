import DatePickerModule from 'react-multi-date-picker';
import persianCalendar from 'react-date-object/calendars/persian';
import persianAfghanistan from '../../locales/persianAfghanistan';

// پشتیبانی از شکل‌های متفاوت export کتابخانه در محیط‌های مختلف build.
const ResolvedDatePicker =
  DatePickerModule?.default?.default ??
  DatePickerModule?.default ??
  DatePickerModule;

// پوشش یکپارچه تقویم شمسی افغانستان؛ منطق تبدیل تاریخ در dateUtils باقی می‌ماند.
function PersianDatePicker({
  calendar = persianCalendar,
  locale = persianAfghanistan,
  format = 'DD MMMM YYYY',
  calendarPosition = 'bottom-right',
  weekStartDayIndex = 0,
  editable = false,
  ...datePickerProps
}) {
  return (
    <ResolvedDatePicker
      calendar={calendar}
      locale={locale}
      format={format}
      calendarPosition={calendarPosition}
      weekStartDayIndex={weekStartDayIndex}
      editable={editable}
      {...datePickerProps}
    />
  );
}

export default PersianDatePicker;
