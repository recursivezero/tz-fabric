import re
from typing import Optional
import easyocr
from PIL import Image


class AadhaarCardExtractor:
    """
    Regex-first Aadhaar extractor with strict front/back separation.
    """

    AADHAAR_PATTERN = re.compile(r'\b\d{4}\s?\d{4}\s?\d{4}\b')
    AADHAAR_MASKED_PATTERN = re.compile(r'\b[X×*]{4,8}\s?\d{4}\b')
    DOB_SUBSTRING_PATTERN = re.compile(r'(\d{2})[./-](\d{2})[./-](\d{4})')
    YEAR_PATTERN = re.compile(r'\b(19|20)\d{2}\b')
    GENDER_PATTERN = re.compile(r'\b(MALE|FEMALE|TRANSGENDER|M|F|T)\b', re.I)
    PINCODE_PATTERN = re.compile(r'\b\d{6}\b')

    OCR_CHAR_MAP = {
        '0': ['O', 'D', 'Q'],
        '1': ['I', 'L', '|'],
        '2': ['Z'],
        '5': ['S'],
        '8': ['B'],
    }

    IGNORE_KEYWORDS = {
        'GOVERNMENT', 'INDIA', 'AADHAAR', 'AADHAR', 'UNIQUE',
        'IDENTIFICATION', 'AUTHORITY', 'DOB', 'DATE', 'BIRTH',
        'HELP', 'SECURE', 'IDENTITY', 'ENROLLMENT', 'ISSUED',
        'CARD', 'NUMBER',"VID"
    }

    ADDRESS_INDICATORS = {
        'S/O', 'D/O', 'C/O', 'W/O', 'H/O', 'HOUSE', 'ROAD',
        'STREET', 'VILLAGE', 'DISTRICT', 'STATE', 'PIN'
    }

    def __init__(self):
        self.reader = easyocr.Reader(['en'], gpu=False)

    # ------------------------------------------------------------------
    # NORMALIZATION
    # ------------------------------------------------------------------

    def normalize_text(self, text: str) -> str:
        return ' '.join(text.upper().split())

    def should_ignore(self, text: str) -> bool:
        return any(k in text for k in self.IGNORE_KEYWORDS)

    # ------------------------------------------------------------------
    # OCR CLEANING
    # ------------------------------------------------------------------

    def clean_ocr_results(self, ocr_results, min_conf=0.45):
        cleaned = []
        for bbox, text, conf in ocr_results:
            t = self.normalize_text(text)
            if conf < min_conf:
                continue
            if len(t) < 3:
                continue
            if self.should_ignore(t):
                continue
            if not re.search(r'[AEIOU]', t):
                continue
            cleaned.append((bbox, t, conf))
        return cleaned

    # ------------------------------------------------------------------
    # VALIDATORS
    # ------------------------------------------------------------------

    def is_valid_name(self, text: str) -> bool:
        if not re.fullmatch(r'[A-Z ]+', text):
            return False
        words = text.split()
        if not (1 <= len(words) <= 5):
            return False
        has_real = False
        for w in words:
            if len(w) == 1:
                continue
            if not re.search(r'[AEIOU]', w):
                return False
            has_real = True
        return has_real

    def is_address_text(self, text: str) -> bool:
        if any(k in text for k in self.ADDRESS_INDICATORS):
            return True
        if self.PINCODE_PATTERN.search(text):
            return True
        if re.search(r'\d', text) and len(text.split()) > 3:
            return True
        return False

    # ------------------------------------------------------------------
    # FIELD EXTRACTION
    # ------------------------------------------------------------------

    def extract_aadhaar_number(self, ocr_results):
        candidates = []
        for _, text, conf in ocr_results:
            t = self.normalize_text(text)

            if self.AADHAAR_PATTERN.search(t):
                digits = re.sub(r'\D', '', t)
                if len(digits) == 12:
                    candidates.append((f"{digits[:4]} {digits[4:8]} {digits[8:]}", conf))

            elif self.AADHAAR_MASKED_PATTERN.search(t):
                candidates.append((t, conf * 0.9))

        return max(candidates, key=lambda x: x[1])[0] if candidates else None

    def extract_dob(self, ocr_results):
        full_dates = []
        years = []

        for _, text, conf in ocr_results:
            t = self.normalize_text(text)

            m = self.DOB_SUBSTRING_PATTERN.search(t)
            if m:
                d, mth, y = map(int, m.groups())
                if 1 <= d <= 31 and 1 <= mth <= 12 and 1900 <= y <= 2024:
                    full_dates.append((f"{d:02}/{mth:02}/{y}", conf))
                    continue

            y = self.YEAR_PATTERN.search(t)
            if y:
                years.append((y.group(), conf))

        if full_dates:
            return max(full_dates, key=lambda x: x[1])[0]
        if years:
            return f"Year: {max(years, key=lambda x: x[1])[0]}"
        return None

    def extract_gender(self, ocr_results):
        for _, text, _ in ocr_results:
            m = self.GENDER_PATTERN.search(text.upper())
            if m:
                g = m.group(1).upper()
                return {'M': 'MALE', 'F': 'FEMALE', 'T': 'TRANSGENDER'}.get(g, g)
        return None

    def extract_name(self, cleaned_ocr):
        candidates = [(t, c) for _, t, c in cleaned_ocr if self.is_valid_name(t)]
        return max(candidates, key=lambda x: x[1])[0] if candidates else None

    def extract_address(self, ocr_results):
        lines = [(t, b[0][1]) for b, t, _ in ocr_results if self.is_address_text(t)]
        if not lines:
            return None
        lines.sort(key=lambda x: x[1])
        return ', '.join(l[0] for l in lines[:5])
    def extract_address_paragraph_easyocr(self, image_path: str) -> Optional[str]:
        ocr_paragraphs = self.reader.readtext(
            image_path,
            detail=1,
            paragraph=True
        )

        for item in ocr_paragraphs:
            if len(item) == 3:
                _, text, _ = item
            else:
                _, text = item

            norm = self.normalize_text(text)

            # Look for ADDRESS label
            addr_match = re.search(
                r'(ADDRESS[:\-]?\s*)(.+)', norm, re.IGNORECASE
            )
            if not addr_match:
                continue

            addr_text = addr_match.group(2)

            # Stop at known tail junk
            addr_text = re.split(
                r'\b(VID|AADHAAR|HELP|WWW|UIDAI)\b', addr_text
            )[0]

            # Cleanup OCR noise
            addr_text = re.sub(r'\s+', ' ', addr_text).strip()

            # Must contain digits + state/pincode-like pattern
            if len(addr_text) < 20:
                continue
            if not re.search(r'\d{6}', addr_text):
                continue

            return addr_text

        return None


        best = max(address_candidates, key=lambda x: x[1])[0]

        # Cleanup
        best = best.replace("ADDRESS:", "").replace("ADDRESS", "")
        best = re.sub(r'\s+', ' ', best).strip()

        return best



    def extract_pincode(self, ocr_results):
        for _, text, _ in ocr_results:
            m = self.PINCODE_PATTERN.search(text)
            if m:
                return m.group()
        return None

    # ------------------------------------------------------------------
    # MAIN PIPELINE
    # ------------------------------------------------------------------
    def extract_data(self, image_path: str, side: str):
        assert side in {"front", "back"}

        result = {
            "name": "",
            "aadhaar_number": "",
            "dob": "",
            "gender": "",
            "address": "",
            "pincode": ""
        }

        # RAW OCR (always safe: 3-tuples)
        print("IS aaPIL:", isinstance(image_path, Image.Image))
        raw_ocr = self.reader.readtext(image_path, detail=1)
        cleaned = self.clean_ocr_results(raw_ocr)

        if side == "front":
            result["aadhaar_number"] = self.extract_aadhaar_number(raw_ocr) or ""
            result["dob"] = self.extract_dob(raw_ocr) or ""
            result["gender"] = self.extract_gender(raw_ocr) or ""
            result["name"] = self.extract_name(cleaned) or ""

        if side == "back":
            result["aadhaar_number"] = self.extract_aadhaar_number(raw_ocr) or ""
            result["pincode"] = self.extract_pincode(raw_ocr) or ""

            # Paragraph OCR ONLY for address
            result["address"] = self.extract_address_paragraph_easyocr(image_path) or ""

        return result

