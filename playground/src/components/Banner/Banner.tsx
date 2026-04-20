import clsx from 'clsx';
import type { ComponentProps, ReactNode } from 'react';
import { FlexBox } from '../../layout';
import { Body } from '../Body';
import { Label } from '../Label';
import styles from './Banner.module.css';

type Color = 'base' | 'accent' | 'positive' | 'attention' | 'negative';

type CustomProps = {
  color?: Color;
  leading?: ReactNode;
  title: string;
  description?: string;
  trailing?: ReactNode;
};
type ElementProps = Omit<ComponentProps<'button'>, keyof CustomProps | 'color'>;
export type BannerProps = ElementProps & CustomProps;

export const Banner = ({
  color = 'base',
  leading,
  title,
  description,
  trailing,
  className,
  ...props
}: BannerProps) => {
  const classes = clsx(styles.banner, className, {
    [styles[`-color-${color}`]]: color,
  });

  return (
    <button className={classes} {...props} type="button">
      <FlexBox
        spacingVertical="small"
        spacingHorizontal="small"
        gap="small"
        direction="row"
      >
        {leading && <div className={styles._leading}>{leading}</div>}
        <div className={styles._body}>
          <Label as="div" className={styles._title}>
            {title}
          </Label>
          {description && (
            <Body as="div" size="small" className={styles._description}>
              {description}
            </Body>
          )}
        </div>
        {trailing && <div className={styles._trailing}>{trailing}</div>}
      </FlexBox>
    </button>
  );
};
