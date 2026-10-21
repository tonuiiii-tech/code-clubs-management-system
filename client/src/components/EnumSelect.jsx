import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from 'steamlabsui';

/**
 * A Select for one of the shared enums. Labels come from i18n: `${labelKey}.${value}`.
 * `placeholder` adds an empty first option ("All regions", "Choose a school"…).
 */
export const EnumSelect = forwardRef(function EnumSelect(
  { values, labelKey, placeholder, ...props },
  ref,
) {
  const { t } = useTranslation();
  return (
    <Select ref={ref} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {values.map((value) => (
        <option key={value} value={value}>
          {labelKey ? t(`${labelKey}.${value}`) : value}
        </option>
      ))}
    </Select>
  );
});
