import { FlexBox } from '../../layout';
import type { EditorFile } from './types';

interface FileTabsProps {
  openFiles: EditorFile[];
  activeFileId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export function FileTabs({
  openFiles,
  activeFileId,
  onSelect,
  onClose,
}: FileTabsProps) {
  if (openFiles.length === 0) return null;

  return (
    <FlexBox className="file-tabs" direction="row" grow={1}>
      {openFiles.map((file) => (
        <FlexBox
          as="div"
          key={file.id}
          className={`file-tab ${activeFileId === file.id ? 'active' : ''}`}
          direction="row"
          align="center"
        >
          <button
            type="button"
            className="file-tab-name"
            onClick={() => onSelect(file.id)}
          >
            {file.name}
          </button>
          <button
            type="button"
            className="file-tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose(file.id);
            }}
          >
            ×
          </button>
        </FlexBox>
      ))}
    </FlexBox>
  );
}
