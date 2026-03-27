import sys
import os

# Set up path to import backend services
sys.path.append(os.path.abspath("backend"))

from services.rules_engine import RetirementRulesEngine
import json

def test_retirement_rules():
    print("--- Retirement Rules Verification (Reform 2023) ---")
    
    # Test Case 1: Serge (Born 1976) - Should be 64y / 172q
    serge_res = RetirementRulesEngine.project_future_career(
        total_points=3500.0,
        birth_year=1976,
        current_salary=45000.0,
        current_quarters=120
    )
    print(f"\n[Test Serge 1976]:")
    print(f"Age légal: {serge_res['legal_age_display']}")
    print(f"Trimestres requis: {serge_res['required_quarters']}")
    print(f"Projection: {serge_res['estimated_monthly_pension']}€/mois")
    
    # Test Case 2: User born in 1961 - Should be 62y 3m / 169q
    user61_res = RetirementRulesEngine.project_future_career(
        total_points=3000.0,
        birth_year=1961,
        current_salary=40000.0,
        current_quarters=160
    )
    print(f"\n[Test Génération 1961]:")
    print(f"Age légal: {user61_res['legal_age_display']}")
    print(f"Trimestres requis: {user61_res['required_quarters']}")
    
    # Test Case 3: User born in 1964 - Should be 63y / 171q
    user64_res = RetirementRulesEngine.project_future_career(
        total_points=3200.0,
        birth_year=1964,
        current_salary=42000.0,
        current_quarters=150
    )
    print(f"\n[Test Génération 1964]:")
    print(f"Age légal: {user64_res['legal_age_display']}")
    print(f"Trimestres requis: {user64_res['required_quarters']}")

if __name__ == "__main__":
    test_retirement_rules()
