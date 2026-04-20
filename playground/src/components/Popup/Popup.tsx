import clsx from 'clsx';
import {
  type ComponentProps,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useRef,
} from 'react';
import { FlexBox } from '../../layout';
import { Body } from '../Body';
import { Title } from '../Title';
import styles from './Popup.module.css';

type CustomProps = {
  isActive: boolean;
  setIsActive: Dispatch<SetStateAction<boolean>>;
  media?: ReactNode;
  title: string;
  description?: ReactNode;
  footer: ReactNode;
};
type ElementProps = Omit<ComponentProps<'dialog'>, keyof CustomProps>;
export type PopupProps = ElementProps & CustomProps;

export const Popup = ({
  children,
  className,
  isActive,
  media,
  title,
  description,
  footer,
  setIsActive,
  ...props
}: PopupProps) => {
  const classes = clsx(styles.popup, className);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isActive && !dialog.open) {
      dialog.showModal();
    } else if (!isActive && dialog.open) {
      dialog.close();
    }
  }, [isActive]);

  return (
    <dialog
      {...props}
      ref={dialogRef}
      className={classes}
      onCancel={(e) => {
        e.preventDefault();
        setIsActive(false);
      }}
    >
      <button
        className={styles._button}
        type="button"
        onClick={() => setIsActive(false)}
      >
        Close
      </button>
      <FlexBox
        gap="medium"
        spacingBottom="large"
        spacingHorizontal="medium"
        className={styles._content}
      >
        {media && <div>{media}</div>}
        <Title as="h1" size="small">
          {title}
        </Title>
        {description && <Body size="small">{description}</Body>}
        {children}
      </FlexBox>
      <FlexBox spacingVertical="medium" spacingHorizontal="medium">
        {footer}
      </FlexBox>
    </dialog>
  );
};
