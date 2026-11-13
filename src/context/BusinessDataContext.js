import {
  createContext,
  useContext,
} from 'react';

// ایجاد بستر اطلاعات مشترک
const BusinessDataContext = createContext(null);

// دسترسی صفحات به اطلاعات مشترک
export function useBusinessData() {
  const context = useContext(BusinessDataContext);

  if (!context) {
    throw new Error(
      'این کامپوننت باید داخل BusinessDataProvider قرار بگیرد.'
    );
  }

  return context;
}

// در اختیار قرار دادن Context برای Provider
export default BusinessDataContext;