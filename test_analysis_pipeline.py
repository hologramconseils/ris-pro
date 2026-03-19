
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from services.ris_parser import parse_ris_file
import json

test_file = 'backend/uploads/ebd02555-419d-427e-a2c4-4060f80ddea4_rise3.pdf'
if not os.path.exists(test_file):
    print(f"Test file not found: {test_file}")
    sys.exit(1)

print(f"Testing analysis for: {test_file}")
try:
    result = parse_ris_file(test_file)
    print("--- PARSE RESULT ---")
    print(json.dumps({k: v for k, v in result.items() if k != 'images' and k != 'raw_text'}, indent=2))
    print("--- TEXT LENGTH ---")
    print(len(result.get('raw_text', '')))
    print("--- IS SCANNED ---")
    print(result.get('is_scanned'))
except Exception as e:
    print(f"CRITICAL ERROR DURING PARSE: {e}")
    import traceback
    traceback.print_exc()
