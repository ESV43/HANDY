export type OutputFileFormat = 'pdf' | 'tex';

export type FileStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface UploadedFile {
    id: string;
    file: File;
    status: FileStatus;
    output: string | PdfContent | null;
}

export interface ContentItem {
    type: 'heading1' | 'heading2' | 'paragraph' | 'bullet_list' | 'numbered_list';
    text: string;
    items: string[];
}

export interface PdfContent {
    title: string;
    content: ContentItem[];
}
