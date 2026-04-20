import clsx from 'clsx';
import type { ComponentProps, ReactNode } from 'react';
import { FlexBox } from '../../layout';
import { Body } from '../Body';
import styles from './SelectableField.module.css';

type CustomProps = {
  title?: string;
  footer?: ReactNode;
  options: Array<{
    value: string;
    label: string;
  }>;
};

type ElementProps = Omit<ComponentProps<'select'>, keyof CustomProps>;
export type SelectableFieldProps = ElementProps & CustomProps;

export const SelectableField = ({
  title,
  footer,
  name,
  className,
  options,
  id,
  ...props
}: SelectableFieldProps) => {
  const classes = clsx(styles['selectable-field'], className);
  const selectId = id || name;

  return (
    <label htmlFor={selectId} className={classes}>
      <FlexBox gap="small">
        {title && <Body size="small">{title}</Body>}
        <FlexBox className={styles._input}>
          <select {...props} name={name} id={selectId}>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FlexBox>
        {footer && (
          <FlexBox
            width="full"
            direction="row"
            align="center"
            justify="center"
            gap="extra-small"
            className={styles._footer}
          >
            {footer}
          </FlexBox>
        )}
      </FlexBox>
    </label>
  );
};
