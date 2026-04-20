import clsx from 'clsx';
import { type ComponentProps, createElement } from 'react';
import styles from './Headline.module.css';

type HeadingElement = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
type HeadlineElement = HeadingElement | 'div' | 'span';
type TextAlign = 'start' | 'center' | 'end';
type Emphasis = 'high' | 'mid' | 'low';
type Size = 'small' | 'medium' | 'large';

type CustomProps = {
  as: HeadlineElement;
  align?: TextAlign;
  emphasis?: Emphasis;
  size?: Size;
  isInverted?: boolean;
  isOnScrim?: boolean;
};
type ElementProps = Omit<ComponentProps<HeadingElement>, keyof CustomProps>;
export type HeadlineProps = CustomProps & ElementProps;

export const Headline = ({
  align = 'start',
  children,
  className,
  emphasis = 'high',
  as,
  size = 'medium',
  isInverted,
  isOnScrim,
  ...props
}: HeadlineProps) => {
  const classes = clsx(styles.headline, className, {
    [styles[`-align-${align}`]]: align,
    [styles[`-emphasis-${emphasis}`]]: emphasis,
    [styles[`-size-${size}`]]: size,
    [styles['-is-inverted']]: isInverted,
    [styles['-is-on-scrim']]: isOnScrim,
  });

  return createElement(as, { ...props, className: classes }, children);
};
