import clsx from 'clsx';
import { type ComponentProps, createElement } from 'react';
import styles from './FlexBox.module.css';

type FlexBoxElement =
  | 'div'
  | 'section'
  | 'article'
  | 'aside'
  | 'header'
  | 'footer'
  | 'ul'
  | 'ol'
  | 'li'
  | 'span';

type Spacing =
  | 'three-extra-small'
  | 'two-extra-small'
  | 'extra-small'
  | 'small'
  | 'medium'
  | 'large'
  | 'extra-large'
  | 'two-extra-large'
  | 'three-extra-large'
  | 'four-extra-large'
  | 'five-extra-large'
  | 'six-extra-large'
  | 'none';
type Direction = 'row' | 'column' | 'row-reverse' | 'column-reverse';
type Align = 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
type Justify =
  | 'flex-start'
  | 'center'
  | 'flex-end'
  | 'stretch'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';
type Wrap = 'wrap' | 'nowrap' | 'wrap-reverse';
type WidthAndHeight = 'full' | 'hug';

type CustomProps = {
  as?: FlexBoxElement;
  color?: 'base' | 'accent';
  spacing?: Spacing;
  spacingTop?: Spacing;
  spacingRight?: Spacing;
  spacingBottom?: Spacing;
  spacingLeft?: Spacing;
  spacingHorizontal?: Spacing;
  spacingVertical?: Spacing;
  gap?: Spacing;
  direction?: Direction;
  align?: Align;
  justify?: Justify;
  wrap?: Wrap;
  grow?: 0 | 1;
  shrink?: 0 | 1;
  width?: WidthAndHeight;
  height?: WidthAndHeight;
};
type ElementProps = Omit<ComponentProps<FlexBoxElement>, keyof CustomProps>;
export type FlexBoxProps = CustomProps & ElementProps;

const tokenClass = (prefix: string, value: unknown): string | undefined =>
  value === undefined || value === null
    ? undefined
    : styles[`-${prefix}-${value}`];

export const FlexBox = ({
  as = 'div',
  children,
  className,
  color,
  spacing,
  spacingTop,
  spacingRight,
  spacingBottom,
  spacingLeft,
  spacingHorizontal,
  spacingVertical,
  gap,
  direction,
  align = 'stretch',
  justify,
  wrap,
  grow,
  shrink,
  width,
  height,
  ...props
}: FlexBoxProps) => {
  const classes = clsx(
    styles['flex-box'],
    className,
    color && styles[`-color-${color}`],
    tokenClass('spacing', spacing),
    tokenClass('spacing-top', spacingTop),
    tokenClass('spacing-right', spacingRight),
    tokenClass('spacing-bottom', spacingBottom),
    tokenClass('spacing-left', spacingLeft),
    tokenClass('spacing-horizontal', spacingHorizontal),
    tokenClass('spacing-vertical', spacingVertical),
    tokenClass('gap', gap),
    tokenClass('direction', direction),
    tokenClass('align', align),
    tokenClass('justify', justify),
    tokenClass('wrap', wrap),
    tokenClass('grow', grow),
    tokenClass('shrink', shrink),
    tokenClass('width', width),
    tokenClass('height', height),
  );

  return createElement(as, { ...props, className: classes }, children);
};
