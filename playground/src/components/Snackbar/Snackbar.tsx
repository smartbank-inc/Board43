import clsx from 'clsx';
import type { ComponentProps, ReactNode } from 'react';
import { FlexBox } from '../../layout';
import { Body } from '../Body';
import styles from './Snackbar.module.css';

type Color = 'positive' | 'attention';

type CustomProps = {
  color: Color;
  leading?: ReactNode;
  isActive: boolean;
  bottom?: number;
};
type ElementProps = Omit<ComponentProps<'div'>, keyof CustomProps>;
export type SnackbarProps = ElementProps & CustomProps;

export const Snackbar = ({
  children,
  className,
  leading,
  color,
  isActive,
  bottom,
  ...props
}: SnackbarProps) => {
  const classes = clsx(styles.snackbar, className, {
    [styles['--activated']]: isActive,
  });

  const containerClasses = clsx(styles._container, {
    [styles[`-color-${color}`]]: color,
  });

  return (
    <FlexBox
      {...props}
      spacingVertical="medium"
      spacingHorizontal="medium"
      className={classes}
      style={{ bottom }}
    >
      <FlexBox
        className={containerClasses}
        spacingVertical="extra-small"
        spacingHorizontal="medium"
        direction="row"
        align="center"
        gap="extra-small"
      >
        {leading && (
          <FlexBox width="hug" className={styles._leading}>
            {leading}
          </FlexBox>
        )}
        <FlexBox grow={1}>
          <Body isInverted emphasis="high">
            {children}
          </Body>
        </FlexBox>
      </FlexBox>
    </FlexBox>
  );
};
