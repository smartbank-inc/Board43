import clsx from 'clsx';
import { type ComponentProps, createElement } from 'react';
import styles from './Label.module.css';

type TextElement = 'p' | 'span' | 'div';
type TextAlign = 'start' | 'center' | 'end';
type Emphasis = 'high' | 'mid' | 'low';
type Size = 'small' | 'medium' | 'large';

type CustomProps = {
  as?: TextElement;
  align?: TextAlign;
  emphasis?: Emphasis;
  size?: Size;
  isInverted?: boolean;
  isOnScrim?: boolean;
};
type ElementProps = Omit<ComponentProps<TextElement>, keyof CustomProps>;
export type LabelProps = CustomProps & ElementProps;

export const Label = ({
  align = 'start',
  as = 'p',
  children,
  className,
  emphasis = 'high',
  isInverted,
  isOnScrim,
  size,
  ...props
}: LabelProps) => {
  const classes = clsx(styles.label, className, {
    [styles[`-align-${align}`]]: align,
    [styles[`-emphasis-${emphasis}`]]: emphasis,
    [styles['-is-inverted']]: isInverted,
    [styles['-is-on-scrim']]: isOnScrim,
    [styles[`-size-${size}`]]: size,
  });

  return createElement(as, { ...props, className: classes }, children);
};
