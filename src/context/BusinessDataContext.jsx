
import {
  createContext,
  useContext,
  useMemo,
  useState,
} from 'react';

import {
  initialCategories,
  initialProducts,
  initialUnits,
  initialUnitConversions,
} from '../data/demoData';

// ایجاد بستر اطلاعات مشترک
const BusinessDataContext = createContext(null);

// نگهداری اطلاعات مشترک صفحات
export function BusinessDataProvider({ children }) {
  // تعریف وضعیت کالاها
  const [categories, setCategories] = useState(initialCategories);
  const [products, setProducts] = useState(initialProducts);

  // تعریف واحد اندازه گیری کالاها
  const [units, setUnits] = useState(initialUnits);

  const [unitConversions, setUnitConversions] = useState(
    initialUnitConversions
  );

  const value = useMemo(
    () => ({
      categories,
      setCategories,

      products,
      setProducts,

      units,
      setUnits,

      unitConversions,
      setUnitConversions
    }),
    [categories, products]
  );

  return (
    <BusinessDataContext.Provider value={value}>
      {children}
    </BusinessDataContext.Provider>
  );
}

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
