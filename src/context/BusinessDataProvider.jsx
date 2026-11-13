import {
  useMemo,
  useState,
} from 'react';

import BusinessDataContext from './BusinessDataContext';

import {
  initialCategories,
  initialProducts,
  initialUnits,
  initialUnitConversions,
} from '../data/demoData';

// نگهداری اطلاعات مشترک صفحات
export function BusinessDataProvider({ children }) {

  // وضعیت دسته‌بندی‌ها
  const [categories, setCategories] = useState(initialCategories);

  // وضعیت کالاها
  const [products, setProducts] = useState(initialProducts);

  // وضعیت واحدهای اندازه‌گیری
  const [units, setUnits] = useState(initialUnits);

  // وضعیت تبدیل واحدها
  const [unitConversions, setUnitConversions] = useState(
    initialUnitConversions
  );

  // آماده‌سازی اطلاعات مشترک برای صفحات
  const value = useMemo(
    () => ({
      categories,
      setCategories,

      products,
      setProducts,

      units,
      setUnits,

      unitConversions,
      setUnitConversions,
    }),
    [categories, products, units, unitConversions]
  );

  return (
    <BusinessDataContext.Provider value={value}>
      {children}
    </BusinessDataContext.Provider>
  );
}