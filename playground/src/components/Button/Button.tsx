import clsx from 'clsx';
import type { ComponentProps } from 'react';
import styles from './Button.module.css';

type Appearance = 'filled' | 'outlined' | 'tonal' | 'destructive';
type Size = 'small' | 'medium';
type Width = 'full' | 'hug';

type CustomProps = {
  appearance?: Appearance;
  size?: Size;
  width?: Width;
};
type ElementProps = Omit<ComponentProps<'button'>, keyof CustomProps>;
export type ButtonProps = CustomProps & ElementProps;

export const Button = ({
  appearance = 'filled',
  children,
  className,
  size = 'medium',
  width = 'full',
  type = 'button',
  ...props
}: ButtonProps) => {
  const classes = clsx(styles.button, className, {
    [styles[`-appearance-${appearance}`]]: appearance,
    [styles[`-size-${size}`]]: size,
    [styles[`-width-${width}`]]: width,
  });

  return (
    <button {...props} type={type} className={classes}>
      {children}
    </button>
  );
};
