import re
from typing import Dict, List, Tuple, Optional
import easyocr # type: ignore
from itertools import product
from PIL import Image

class PANCardExtractor:
    """Extract structured data from PAN card images using pure regex and pattern matching."""
    
    # Strict regex patterns
    PAN_PATTERN = re.compile(r'^[A-Z]{5}[0-9]{4}[A-Z]$')
    DOB_PATTERN = re.compile(r'\b(\d{2})[/-](\d{2})[/-](\d{4})\b')
    
    # Common OCR misreads for normalization
    OCR_CHAR_MAP = {
    '0': ['O', 'D', 'Q'],
    '1': ['I', 'L', '|'],
    '2': ['Z'],
    '5': ['S'],
    '6': ['G'],     # ← you were missing this
    '8': ['B'],
}

    
    # Keywords to ignore
    IGNORE_KEYWORDS = {
        'INCOME', 'TAX', 'DEPARTMENT', 'GOVT', 'INDIA', 
        'PERMANENT', 'ACCOUNT', 'NUMBER', 'SIGNATURE',
        'CARD', 'PAN', 'DATE', 'BIRTH', 'FATHER', 'NAME','HRT','TTer'
    }
    
    # Father's name indicators
    FATHER_INDICATORS = [
        "FATHER'S NAME", "FATHER NAME", "FATHERS NAME",
        "S/O", "SO", "D/O", "DO", "C/O", "CO"
    ]
    
    def __init__(self):
        """Initialize EasyOCR reader."""
        self.reader = easyocr.Reader(['en'], gpu=False)
    
    def normalize_text(self, text: str) -> str:
        """Convert to uppercase and normalize spacing."""
        return ' '.join(text.upper().split())
    
    def should_ignore(self, text: str) -> bool:
        """Check if text contains any ignore keywords."""
        text_upper = text.upper()
        return any(keyword in text_upper for keyword in self.IGNORE_KEYWORDS)
    
    def normalize_pan_ocr_errors(self, text: str) -> List[str]:
        text=self.normalize_text(text)
        if len(text) != 10:
            return []
        if any(c in text for c in "/-:."):
            return []

        # Hard gate: only alphanumerics allowed
        if not text.isalnum():
            return []

        candidates = []

        # Prepare replacement options per position
        options = []

        for i, ch in enumerate(text):
            opts = [ch]

            if i in [0,1,2,3,4,9]:  # letter positions
                if ch.isdigit() and ch in self.OCR_CHAR_MAP:
                    opts.extend(self.OCR_CHAR_MAP[ch])


            if i in [5,6,7,8]:  # digit positions
                if ch.isalpha():
                    for k, v in self.OCR_CHAR_MAP.items():
                        if k.isdigit() and ch in v:
                            opts.append(k)

            options.append(list(set(opts)))

        # Generate combinations
        for combo in product(*options):
            print(combo)
            pan = "".join(combo)
            if self.PAN_PATTERN.fullmatch(pan):
                candidates.append(pan)
                break

        return candidates
    
    def normalize_dob_ocr_errors(self, text: str) -> Optional[str]:
        """
        Normalize DOB by fixing common OCR errors.
        Expected final format: DD/MM/YYYY
        """
        text = self.normalize_text(text)

        # Replace obvious separators
        text = text.replace('.', '/').replace('-', '/')

        # Hard-length gate (DOB must be 10 chars)
        if len(text) != 10:
            return None

        chars = list(text)

        # Fix OCR errors for '/'
        for idx in (2, 5):
            if chars[idx] in {'1', 'I', 'l', '|'}:
                chars[idx] = '/'

        text = "".join(chars)

        # Now validate structure strictly
        match = self.DOB_PATTERN.fullmatch(text)
        if not match:
            return None

        day, month, year = match.groups()

        try:
            day_int = int(day)
            month_int = int(month)
            year_int = int(year)

            if not (1 <= day_int <= 31):
                return None
            if not (1 <= month_int <= 12):
                return None
            if not (1900 <= year_int <= 2024):
                return None

            return text
        except ValueError:
            return None

    def is_valid_name(self, text: str) -> bool:
        """
        Validate name:
        - Only alphabets and spaces
        - At least 2 words
        - No digits or special characters
        - Each word at least 2 characters
        """
        if not text or self.should_ignore(text):
            return False
        
        # Check for digits or special characters (except spaces)
        if re.search(r'[^A-Z\s]', text):
            return False
        
        # Must have at least 2 words
        words = text.split()
        if len(words) < 2:
            return False
        
        # Each word should be at least 2 characters
        if not all(len(word) >= 2 for word in words):
            return False
        
        # Not too many words (likely noise)
        if len(words) > 5:
            return False
        
        return True
    
    def is_father_indicator(self, text: str) -> bool:
        """Check if text contains father's name indicator."""
        text_upper = text.upper()
        return any(indicator in text_upper for indicator in self.FATHER_INDICATORS)

    def is_father_indicator(self, text: str) -> bool:
        """Check if text contains father's name indicator."""
        text_upper = text.upper()
        return any(indicator in text_upper for indicator in self.FATHER_INDICATORS)
    
    def extract_pan_number(self, ocr_results: List[Tuple]) -> Optional[str]:
        """
        Extract PAN number using regex with OCR error normalization.
        Returns: pan_number or None
        """
        candidates = []
        
        for bbox, text, conf in ocr_results:
            normalized = self.normalize_text(text)
            print(normalized)
            
            # Direct match
            if self.PAN_PATTERN.match(normalized):
                candidates.append((normalized, conf))
            else:
                print("###")
                # Try fixing OCR errors
                variations = self.normalize_pan_ocr_errors(normalized)
                print(variations)
                for variation in variations:
                    candidates.append((variation, conf * 0.9))  # Slightly lower confidence
        
        if not candidates:
            return None
        print(candidates)
        # Return candidate with highest confidence
        best_candidate = max(candidates, key=lambda x: x[1])
        print(best_candidate)
        return best_candidate[0]
    
    def extract_dob(self, ocr_results: List[Tuple]) -> Optional[str]:
        """
        Extract DOB using regex pattern matching.
        Returns: dob in DD/MM/YYYY format or None
        """
        candidates = []
        
        for bbox, text, conf in ocr_results:
            normalized = self.normalize_text(text)
            
            # Try to extract and normalize DOB
            dob = self.normalize_dob_ocr_errors(normalized)
            if dob:
                candidates.append((dob, conf))
        
        if not candidates:
            return None
        
        # Return candidate with highest confidence
        best_candidate = max(candidates, key=lambda x: x[1])
        return best_candidate[0]
    
    def extract_names(self, ocr_results: List[Tuple]) -> Tuple[Optional[str], Optional[str]]:
        """
        Extract name and father's name using context clues.
        Returns: (name, father_name)
        """
        all_texts = []
        
        # Collect all OCR text with metadata
        for i, (bbox, text, conf) in enumerate(ocr_results):
            normalized = self.normalize_text(text)
            all_texts.append({
                'index': i,
                'text': normalized,
                'conf': conf,
                'is_father_indicator': self.is_father_indicator(normalized),
                'is_valid_name': self.is_valid_name(normalized)
            })
        
        # Find valid name candidates
        name_candidates = [t for t in all_texts if t['is_valid_name']]
        
        if not name_candidates:
            return None, None
        
        # Sort by confidence
        name_candidates.sort(key=lambda x: x['conf'], reverse=True)
        
        # Find father's name indicator
        father_indicator_idx = None
        for t in all_texts:
            if t['is_father_indicator']:
                father_indicator_idx = t['index']
                break
        
        # Strategy 1: If father indicator found, find name after it
        father_name = None
        if father_indicator_idx is not None:
            # Look for name after father indicator
            for candidate in name_candidates:
                if candidate['index'] > father_indicator_idx:
                    father_name = candidate['text']
                    break
        
        # Strategy 2: Get primary name (highest confidence, not father's name)
        name = None
        for candidate in name_candidates:
            if candidate['text'] != father_name:
                name = candidate['text']
                break
        
        # Strategy 3: If no father indicator, use top 2 names
        if father_name is None and len(name_candidates) >= 2:
            # Assume first is name, second is father's name
            filtered_candidates = [c for c in name_candidates if c['conf'] > 0.6]
            if len(filtered_candidates) >= 2:
                name = filtered_candidates[0]['text']
                father_name = filtered_candidates[1]['text']
            elif len(filtered_candidates) == 1:
                name = filtered_candidates[0]['text']
        
        return name, father_name

    
    def extract_data(self, image_path: str) -> Dict[str, str]:
        """
        Main extraction pipeline using pure regex.
        
        Args:
            image_path: Path to PAN card image
            
        Returns:
            Dictionary with extracted fields
        """
        # Initialize result
        result={
        "type": "PAN",
        "name": "",
        "father_name": "",
        "dob": "",
        "pan_number": ""
        }


        
        try:
            # Perform OCR with detail=1 (text, bbox, confidence)
            print("IS PIL:", isinstance(image_path, Image.Image))
            ocr_results = self.reader.readtext(image_path, detail=1)
            
            if not ocr_results:
                return result
            
            
            # Extract fields independently using regex
            pan_number = self.extract_pan_number(ocr_results)
            if pan_number:
                result["pan_number"] = pan_number
            
            dob = self.extract_dob(ocr_results)
            if dob:
                result["dob"] = dob
            
            name, father_name = self.extract_names(ocr_results)
            if name:
                result["name"] = name
            if father_name:
                result["father_name"] = father_name
            
        except Exception as e:
            # On any error, return empty result
            print(f"Error processing image: {e}")
            return result
        
        return result

