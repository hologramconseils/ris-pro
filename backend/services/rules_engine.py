from datetime import datetime
from typing import Dict, List, Optional, Any

# Historical data for Plafond Annuel de la Sécurité Sociale (PASS) and Agirc-Arrco point values
# Unified since 2019. Separate Agirc/Arrco before.
RETIREMENT_RESOURCES = {
    2025: {"pass": 47100.0, "unified": {"purchase": 20.1877, "service": 1.4386}},
    2024: {"pass": 46368.0, "unified": {"purchase": 19.6321, "service": 1.4159}},
    2023: {"pass": 43992.0, "unified": {"purchase": 18.7669, "service": 1.3498}},
    2022: {"pass": 41136.0, "unified": {"purchase": 17.4316, "service": 1.2841}},
    2021: {"pass": 41136.0, "unified": {"purchase": 17.3982, "service": 1.2714}},
    2020: {"pass": 41136.0, "unified": {"purchase": 17.3982, "service": 1.2714}},
    2019: {"pass": 40524.0, "unified": {"purchase": 17.0571, "service": 1.2588}},
    2018: {"pass": 39732.0, "arrco": {"purchase": 16.7226, "service": 1.2588}, "agirc": {"purchase": 5.8166, "service": 0.4378}},
    2017: {"pass": 39228.0, "arrco": {"purchase": 16.1879, "service": 1.2513}, "agirc": {"purchase": 5.6306, "service": 0.4352}},
    2016: {"pass": 38616.0, "arrco": {"purchase": 15.9960, "service": 1.2513}, "agirc": {"purchase": 5.5638, "service": 0.4352}},
    2015: {"pass": 38040.0, "arrco": {"purchase": 15.6556, "service": 1.2513}, "agirc": {"purchase": 5.4457, "service": 0.4352}},
    2014: {"pass": 37548.0, "arrco": {"purchase": 15.6556, "service": 1.2513}, "agirc": {"purchase": 5.4457, "service": 0.4352}},
    2013: {"pass": 37032.0, "arrco": {"purchase": 15.2284, "service": 1.2513}, "agirc": {"purchase": 5.3006, "service": 0.4352}},
    2012: {"pass": 36372.0, "arrco": {"purchase": 15.0528, "service": 1.2414}, "agirc": {"purchase": 5.2509, "service": 0.4330}},
    2011: {"pass": 35352.0, "arrco": {"purchase": 14.7216, "service": 1.2135}, "agirc": {"purchase": 5.1354, "service": 0.4233}},
    2010: {"pass": 34620.0, "arrco": {"purchase": 14.4047, "service": 1.1884}, "agirc": {"purchase": 5.0249, "service": 0.4216}},
    2009: {"pass": 34308.0, "arrco": {"purchase": 14.2198, "service": 1.1799}, "agirc": {"purchase": 4.9604, "service": 0.4186}},
    2008: {"pass": 33276.0, "arrco": {"purchase": 13.9684, "service": 1.1648}, "agirc": {"purchase": 4.8727, "service": 0.4132}},
    2007: {"pass": 32184.0, "arrco": {"purchase": 13.5091, "service": 1.1480}, "agirc": {"purchase": 4.7125, "service": 0.4073}},
    2006: {"pass": 31068.0, "arrco": {"purchase": 13.0271, "service": 1.1287}, "agirc": {"purchase": 4.5444, "service": 0.4005}},
    2005: {"pass": 30192.0, "arrco": {"purchase": 12.6600, "service": 1.1104}, "agirc": {"purchase": 4.4163, "service": 0.3940}},
    2004: {"pass": 29712.0, "arrco": {"purchase": 12.3632, "service": 1.0886}, "agirc": {"purchase": 4.3128, "service": 0.3862}},
    2003: {"pass": 29184.0, "arrco": {"purchase": 12.0852, "service": 1.0698}, "agirc": {"purchase": 4.2158, "service": 0.3796}},
    2002: {"pass": 28224.0, "arrco": {"purchase": 11.8949, "service": 1.0530}, "agirc": {"purchase": 4.1494, "service": 0.3737}},
    2001: {"pass": 27348.0, "arrco": {"purchase": 11.7076, "service": 1.0364}, "agirc": {"purchase": 4.0841, "service": 0.3678}},
    2000: {"pass": 26892.0, "arrco": {"purchase": 11.5345, "service": 1.0171}, "agirc": {"purchase": 4.0231, "service": 0.3596}},
}

RATES = {
    "T1_CALC": 0.062, # 6.20% since 2019
    "T2_CALC": 0.170, # 17% since 2019
    "CALL_RATE": 1.27, # 127%
}

class RetirementRulesEngine:
    @staticmethod
    def get_year_data(year: int) -> Optional[Dict[str, Any]]:
        return RETIREMENT_RESOURCES.get(year)

    @staticmethod
    def calculate_theoretical_points(salary: float, year: int, regime: str = "Agirc-Arrco") -> Dict[str, Any]:
        """Calculates theoretical points based on salary and year."""
        data = RETIREMENT_RESOURCES.get(year)
        if not data:
            return {"points": 0.0, "error": f"Données non disponibles pour l'année {year}"}

        if not isinstance(data, dict):
            return {"points": 0.0, "error": "Internal data error"}

        pass_val = float(data.get("pass", 40000.0))
        
        # Post-2019 Unified Regime
        if year >= 2019 and "unified" in data:
            unified_data = data["unified"]
            if isinstance(unified_data, dict):
                purchase_val = float(unified_data.get("purchase", 20.0))
                t1_base = float(min(salary, pass_val))
                t2_base = float(max(0.0, min(salary - pass_val, pass_val * 7.0)))
                
                points_t1 = (t1_base * RATES["T1_CALC"]) / purchase_val
                points_t2 = (t2_base * RATES["T2_CALC"]) / purchase_val
                
                return {
                    "points": round(float(points_t1 + points_t2), 2),
                    "points_t1": round(float(points_t1), 2),
                    "points_t2": round(float(points_t2), 2),
                    "purchase_value": purchase_val
                }
        
        # Pre-2019: Simplified approach
        pre_data = data.get("arrco") or data.get("unified")
        if not isinstance(pre_data, dict):
             purchase_val = 15.0
        else:
             purchase_val = float(pre_data.get("purchase", 15.0))
             
        points = (salary * 0.06) / purchase_val 
        return {"points": round(float(points), 2), "purchase_value": purchase_val}

    @staticmethod
    def get_reliability_score(calculated_periods: List[Dict[str, Any]]) -> int:
        """Calculates a reliability score (0-100) based on differences."""
        if not calculated_periods:
            return 100
            
        total_ris_points = 0.0
        total_theo_points = 0.0
        for p in calculated_periods:
            total_ris_points += float(p.get("ris_points", 0.0))
            total_theo_points += float(p.get("theo_points", 0.0))
        
        if total_theo_points <= 0:
            return 100 if total_ris_points <= 0 else 50
            
        diff = abs(total_ris_points - total_theo_points)
        error_ratio = diff / total_theo_points
        
        score = max(0, 100 - int(error_ratio * 100))
        return score

    @staticmethod
    def get_assimilated_points_estimate(type_p: str, prev_year_points: float, duration_days: int) -> float:
        """Estimates points for assimilated periods based on rules."""
        if type_p in ["maladie", "maternité"]:
            # Rule: Average points of previous year
            if type_p == "maladie" and duration_days < 60:
                return 0.0
            daily_points = float(prev_year_points) / 365.0
            return round(float(daily_points * duration_days), 2)
        elif type_p == "chômage":
            # Simplified: 60% of previous activity points
            return round(float(prev_year_points * 0.6 * (duration_days / 365.0)), 2)
        return 0.0

    @staticmethod
    def project_future_career(current_age: int, current_salary: float, total_points: float, target_age: int = 64) -> Dict[str, Any]:
        """Simple career projection."""
        years_left = max(0, target_age - current_age)
        calc_res = RetirementRulesEngine.calculate_theoretical_points(current_salary, 2025)
        annual_points = float(calc_res.get("points", 0.0))
        
        projected_points = total_points + (annual_points * years_left)
        data_2025 = RETIREMENT_RESOURCES.get(2025)
        if isinstance(data_2025, dict) and "unified" in data_2025:
             service_val = float(data_2025["unified"].get("service", 1.4))
        else:
             service_val = 1.4
             
        estimated_annual_pension = projected_points * service_val
        
        return {
            "years_left": years_left,
            "projected_points": round(float(projected_points), 2),
            "estimated_annual_pension": round(float(estimated_annual_pension), 2),
            "estimated_monthly_pension": round(float(estimated_annual_pension / 12.0), 2)
        }
