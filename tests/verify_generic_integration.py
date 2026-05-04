import json
from datetime import datetime
from services.rules_engine import RetirementRulesEngine
from routers.upload import _generate_justificatifs_for_entry

def test_generic_validation_native_vs_scanned():
    # 1. Simulate a Native RIS Technical Entry
    native_entry = {
        "year": 2000,
        "salary": 15000.0,
        "ris_quarters": 0,
        "ris_points": 0.0,
        "regime": "Inconnu",
        "employer": "Entreprise A" # Employer from technical table / AI merge
    }
    
    # 2. Simulate a Scanned RIS AI Entry (fallback)
    scanned_entry = {
        "year": 2000,
        "salary": 15000.0,
        "ris_quarters": 0,
        "ris_points": 0.0,
        "regime": "Entreprise A", # AI usually puts it in activite/regime
        "employer": "Entreprise A" # Added by our backfill logic
    }
    
    val_native = RetirementRulesEngine.get_year_validation_status(native_entry)
    val_scanned = RetirementRulesEngine.get_year_validation_status(scanned_entry)
    
    # Assert anomaly detection is identical
    assert val_native['status'] == 'anomalie'
    assert val_scanned['status'] == 'anomalie'
    assert val_native['theo_quarters'] == 4 # > 150h SMIC logic
    assert val_scanned['theo_quarters'] == 4
    
    # Assert employer preservation
    assert val_native['employer'] == "Entreprise A"
    assert val_scanned['employer'] == "Entreprise A"

def test_projection_pension():
    # Validate the projection doesn't throw AttributeError and produces a result
    mock_career_data = [
        {"year": 2021, "salary": 35000.0, "ris_quarters": 4, "ris_points": 250.0, "status": "conforme"},
        {"year": 2022, "salary": 40000.0, "ris_quarters": 4, "ris_points": 300.0, "status": "conforme"}
    ]
    
    projection = RetirementRulesEngine.project_future_career(
        career_data=mock_career_data,
        birth_year=1965,
        current_year=2024
    )
    
    assert projection is not None
    assert "estimated_monthly_pension" in projection
    assert projection["estimated_monthly_pension"] > 0
    assert "estimated_total_points" in projection

def test_justificatifs_generation():
    bad_entry = {
        "year": 2010,
        "salary": 0.0,
        "ris_quarters": 0,
        "ris_points": 0.0,
        "status": "anomalie"
    }
    justificatif = _generate_justificatifs_for_entry(bad_entry)
    assert justificatif is not None
    assert len(justificatif) > 10

if __name__ == "__main__":
    print("Running automated verification suite...")
    test_generic_validation_native_vs_scanned()
    print("✅ Generic validation (Native & Scanned) passed.")
    test_projection_pension()
    print("✅ Pension projection robust and functional.")
    test_justificatifs_generation()
    print("✅ Justificatif generation passed.")
    print("🎉 All generic integration tests passed successfully. Ready for deployment!")
