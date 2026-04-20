import clsx from 'clsx';
import type { ComponentProps } from 'react';
import styles from './Br.module.css';

export type BrProps = ComponentProps<'br'>;

export const Br = ({ className, ...props }: BrProps) => (
  <br {...props} className={clsx(styles.br, className)} />
);
