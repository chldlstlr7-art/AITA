import os
from docx import Document
from pypdf import PdfReader

def extract_text(file_storage):
    """
    Flask의 FileStorage 객체를 받아 확장자에 따라 텍스트를 추출합니다.
    (FileStorage는 .read(), .filename, .save() 등을 지원합니다.)
    """
    text = ""
    filename = file_storage.filename
    file_extension = os.path.splitext(filename)[1].lower()
    
    # 텍스트 파일 (.txt)
    if file_extension == '.txt':
        # .read()는 bytes를 반환하므로 decode가 필요합니다.
        encoding_list = ['utf-8', 'cp949', 'latin-1']
        raw_bytes = file_storage.read()
        for encoding in encoding_list:
            try:
                text = raw_bytes.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
    
    # 워드 파일 (.docx)
    elif file_extension == '.docx':
        try:
            document = Document(file_storage)
            text = '\n'.join([para.text for para in document.paragraphs])
        except Exception as e:
            print(f"DOCX 파싱 오류: {e}")
            pass
    
    # PDF 파일 (.pdf)
    elif file_extension == '.pdf':
        try:
            reader = PdfReader(file_storage)
            text_parts = [page.extract_text() for page in reader.pages if page.extract_text()]
            text = '\n'.join(text_parts)
        except Exception as e:
            print(f"PDF 파싱 오류: {e}")
            pass
    
    return text.strip()
