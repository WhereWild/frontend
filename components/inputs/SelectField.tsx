import React from 'react';
import { SelectFieldView } from './SelectFieldView';
import { useSelectFieldController } from './useSelectFieldController';
import type { SelectFieldProps, SelectOption } from './useSelectFieldController';

export type { SelectFieldProps, SelectOption };

export function SelectField(props: SelectFieldProps) {
  const viewProps = useSelectFieldController(props);
  return <SelectFieldView {...viewProps} />;
}
