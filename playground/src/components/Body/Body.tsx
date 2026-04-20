import clsx from 'clsx';
import { type ComponentProps, createElement } from 'react';
import styles from './Body.module.css';

type TextElement = 'p' | 'span' | 'div';
type TextAlign = 'start' | 'center' | 'end';
type Emphasis = 'high' | 'mid' | 'low';
type Size = 'small' | 'medium' | 'large';
type Weight = 'normal' | 'bold';

type CustomProps = {
  as?: TextElement;
  align?: TextAlign;
  emphasis?: Emphasis;
  size?: Size;
  weight?: Weight;
  isInverted?: boolean;
  isOnScrim?: boolean;
};
type ElementProps = Omit<ComponentProps<TextElement>, keyof CustomProps>;
export type BodyProps = CustomProps & ElementProps;

export const Body = ({
  align = 'start',
  as = 'p',
  children,
  className,
  emphasis = 'high',
  isInverted,
  isOnScrim,
  size = 'medium',
  weight,
  ...props
}: BodyProps) => {
  const classes = clsx(styles.body, className, {
    [styles[`-align-${align}`]]: align,
    [styles[`-emphasis-${emphasis}`]]: emphasis,
    [styles['-is-inverted']]: isInverted,
    [styles['-is-on-scrim']]: isOnScrim,
    [styles[`-size-${size}`]]: size,
    [styles[`-weight-${weight}`]]: weight,
  });

  return createElement(as, { ...props, className: classes }, children);
};
