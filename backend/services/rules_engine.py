from datetime import datetime
from typing import Dict, List, Optional, Any

# Reform 2023: Generation-based legal age and required quarters
GENERATION_RULES = {
    1955: {"legal_age_years": 62, "legal_age_months": 0, "required_quarters": 166},
    1956: {"legal_age_years": 62, "legal_age_months": 0, "required_quarters": 166},
    1957: {"legal_age_years": 62, "legal_age_months": 0, "required_quarters": 166},
    1958: {"legal_age_years": 62, "legal_age_months": 0, "required_quarters": 167},
    1959: {"legal_age_years": 62, "legal_age_months": 0, "required_quarters": 167},
    1960: {"legal_age_years": 62, "legal_age_months": 0, "required_quarters": 167},
    1961: {"legal_age_years": 62, "legal_age_months": 3, "required_quarters": 169},
    1962: {"legal_age_years": 62, "legal_age_months": 6, "required_quarters": 169},
    1963: {"legal_age_years": 62, "legal_age_months": 9, "required_quarters": 170},
    1964: {"legal_age_years": 63, "legal_age_months": 0, "required_quarters": 171},
    1965: {"legal_age_years": 63, "legal_age_months": 3, "required_quarters": 172},
    1966: {"legal_age_years": 63, "legal_age_months": 6, "required_quarters": 172},
    1967: {"legal_age_years": 63, "legal_age_months": 9, "required_quarters": 172},
    1968: {"legal_age_years": 64, "legal_age_months": 0, "required_quarters": 172},
}

# For younger generations, the rule remains 64 years and 172 quarters unless new reform
def get_params_for_year(birth_year: int, birth_month: int = 1) -> Dict[str, Any]:
    return RetirementRulesEngine.get_generation_parameters(birth_year, birth_month)

# Historical data for Plafond Annuel de la Sécurité Sociale (PASS) and Agirc-Arrco point values
RETIREMENT_RESOURCES = {
    2026: {"pass": 48060.0, "unified": {"purchase": 20.1877, "service": 1.4386}},
    2025: {"pass": 47100.0, "unified": {"purchase": 19.6321, "service": 1.4386}},
    2024: {"pass": 46368.0, "unified": {"purchase": 18.7669, "service": 1.4159}},
    2023: {"pass": 43992.0, "unified": {"purchase": 17.4316, "service": 1.3498}},
    2022: {"pass": 41136.0, "unified": {"purchase": 16.8223, "service": 1.2841}},
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

# Historical SMIC hourly gross values as of Jan 1st
SMIC_HISTORY = {
    2026: 12.02, 2025: 11.88, 2024: 11.65, 2023: 11.27, 2022: 10.57,
    2021: 10.25, 2020: 10.15, 2019: 10.03, 2018: 9.88, 2017: 9.76,
    2016: 9.67, 2015: 9.61, 2014: 9.53, 2013: 9.43, 2012: 9.22,
    2011: 9.00, 2010: 8.86, 2009: 8.71, 2008: 8.44, 2007: 8.27,
    2006: 8.03, 2005: 7.61, 2004: 7.19, 2003: 6.83, 2002: 6.67,
    2001: 6.41, 2000: 6.21, 1999: 6.01, 1998: 5.88, 1997: 5.65,
    1996: 5.51, 1995: 5.38, 1994: 5.27, 1993: 5.16, 1992: 5.06,
    1991: 4.89, 1990: 4.56, 1989: 4.38, 1988: 4.25, 1987: 4.10,
    1986: 3.98, 1985: 3.78, 1984: 3.48, 1983: 3.16, 1982: 2.84,
    1981: 2.37, 1980: 1.85, 1979: 1.63, 1978: 1.45, 1977: 1.28,
    1976: 1.13, 1975: 1.05, 1974: 0.88, 1973: 0.76, 1972: 0.69
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
        purchase_val = 15.0 # Default fallback
        if isinstance(pre_data, dict):
            purchase_val = float(pre_data.get("purchase", 15.0))
            
        points = (float(salary) * 0.06) / float(purchase_val)
        return {"points": round(float(points), 2), "purchase_value": float(purchase_val)}

    @staticmethod
    def calculate_theoretical_quarters(salary: float, year: int) -> int:
        """Calculates theoretical quarters based on SMIC rules."""
        # Rule: Current year or future years are not analyzed for quarters
        if year >= datetime.now().year:
            return 0
            
        smic = SMIC_HISTORY.get(year, SMIC_HISTORY[1972] if year < 1972 else SMIC_HISTORY[2025])
        # 150h pre-2014, 200h post-2014
        threshold_h = 200 if year < 2014 else 150
        q_threshold = smic * threshold_h
        
        if q_threshold <= 0: return 0
        quarters = int(salary // q_threshold)
        return min(4, quarters)

    @staticmethod
    def get_year_validation_status(year_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compares RIS data with theoretical calculations for a specific year.
        Expected year_data: {"year": int, "regime": str, "salary": float, "ris_quarters": int, "ris_points": float}
        """
        year = year_data.get("year", 0)
        salary = year_data.get("salary", 0.0)
        ris_q = year_data.get("ris_quarters", 0)
        ris_p = year_data.get("ris_points", 0.0)
        regime = year_data.get("regime", "CNAV")

        theo_q = RetirementRulesEngine.calculate_theoretical_quarters(salary, year)
        theo_p_res = RetirementRulesEngine.calculate_theoretical_points(salary, year, regime)
        theo_p = theo_p_res.get("points", 0.0)

        status = "conforme"
        explanation = ""
        gap = 0.0

        # Point gap (Agirc-Arrco only)
        # Point gap (Agirc-Arrco only) - Informative if 4/4 quarters
        if "agirc" in regime.lower() or "arrco" in regime.lower():
            if salary > 0:
                gap = ris_p - theo_p
                if abs(gap) > (theo_p * 0.15) and theo_p > 5:
                    # Only mark as anomaly if quarters are also incomplete, 
                    # otherwise just keep as informative warning if quarters are 4/4
                    if ris_q < 4:
                        status = "anomalie"
                        explanation = f"Écart de {round(gap, 2)} pts détecté par rapport au salaire déclaré."
                    else:
                        explanation = f"Points cohérents (Écart mineur de {round(gap, 2)} pts)."
            elif ris_p > 0:
                if ris_q < 4:
                    status = "anomalie"
                    explanation = "Points enregistrés sans salaire correspondant."
                else:
                    explanation = "Points enregistrés (Année complète)."
        
        # Quarter gap (Master Rule: 4/4 = Pass)
        if ris_q >= 4:
            status = "conforme"
            if not explanation:
                explanation = f"Année complète : {ris_q} / 4 trimestres"
        else:
            status = "anomalie"
            explanation = f"Année incomplète : {ris_q} / 4 trimestres — anomalie détectée"

        return {
            "year": year,
            "regime": regime,
            "employer": year_data.get("employer", ""),
            "salary": salary,
            "ris_quarters": ris_q,
            "theo_quarters": 4, # Fixed denominator as requested
            "ris_points": ris_p,
            "theo_points": theo_p,
            "gap": round(gap, 2),
            "status": status,
            "explanation": explanation
        }

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
            # Rule: Based on SJR (ARE) or N-1 daily points (ASS). 
            # For audit estimates without SJR, N-1 daily points is the expert standard.
            daily_points = float(prev_year_points) / 365.0
            return round(float(daily_points * duration_days), 2)
        return 0.0

    @staticmethod
    def get_generation_parameters(birth_year: int, birth_month: int = 1) -> Dict[str, Any]:
        """Returns legal age and required quarters for a given birth year and month (Reform 2023)."""
        if birth_year >= 1968:
            return {"legal_age_years": 64, "legal_age_months": 0, "required_quarters": 172}
        if birth_year < 1955:
            return {"legal_age_years": 62, "legal_age_months": 0, "required_quarters": 166}
            
        if birth_year == 1961:
            if birth_month <= 8:
                return {"legal_age_years": 62, "legal_age_months": 0, "required_quarters": 168}
            else:
                return {"legal_age_years": 62, "legal_age_months": 3, "required_quarters": 169}
                
        return GENERATION_RULES.get(birth_year, {"legal_age_years": 64, "legal_age_months": 0, "required_quarters": 172})

    @staticmethod
    def analyze_early_retirement_options(total_quarters: int, birth_year: int, birth_month: int = 1, career_data: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Analyzes early retirement options based on Reform 2023."""
        options = {
            "carriere_longue": {"eligible": False, "earliest_age": None, "details": "Non éligible (Trimestres avant 16/18/20/21 ans insuffisants)."},
            "travailleur_handicape": {"eligible": "Conditionnelle", "earliest_age": 55, "details": "Départ possible dès 55 ans sous condition de trimestres cotisés avec un taux d'incapacité >= 50%."},
            "incapacite_permanente": {"eligible": "Conditionnelle", "earliest_age": 60, "details": "Départ à 60 ans (si IP >= 20%) ou 2 ans avant l'âge légal (si IP 10-19% avec 17 ans d'exposition)."},
            "retraite_progressive": {"eligible": "Conditionnelle", "earliest_age": 60, "details": "Possible dès 60 ans avec au moins 150 trimestres validés et un temps partiel évalué entre 40% et 80%."}
        }
        
        # Check Progressive
        if total_quarters >= 150:
            options["retraite_progressive"]["eligible"] = True
            options["retraite_progressive"]["details"] = "Éligible sur le critère d'assurance (>= 150 trimestres). Départ dès 60 ans si temps partiel (40-80%)."
        else:
            options["retraite_progressive"]["eligible"] = False
            options["retraite_progressive"]["details"] = f"Non éligible : {total_quarters}/150 trimestres requis."

        # Analyze Carrière Longue based on actual career
        if career_data:
            q_at_16 = sum(int(y.get("ris_quarters", 0)) for y in career_data if y.get("year", 9999) <= birth_year + 16)
            q_at_18 = sum(int(y.get("ris_quarters", 0)) for y in career_data if y.get("year", 9999) <= birth_year + 18)
            q_at_20 = sum(int(y.get("ris_quarters", 0)) for y in career_data if y.get("year", 9999) <= birth_year + 20)
            q_at_21 = sum(int(y.get("ris_quarters", 0)) for y in career_data if y.get("year", 9999) <= birth_year + 21)
            
            # Require 5 quarters, or 4 if born between Oct and Dec.
            required_early_q = 4 if birth_month >= 10 else 5
            
            if q_at_16 >= required_early_q:
                options["carriere_longue"] = {"eligible": True, "earliest_age": 58, "details": f"Éligible départ 58 ans ({q_at_16} trimestres validés à la fin de l'année des 16 ans)."}
            elif q_at_18 >= required_early_q:
                options["carriere_longue"] = {"eligible": True, "earliest_age": 60, "details": f"Éligible départ 60 ans ({q_at_18} trimestres validés à la fin de l'année des 18 ans)."}
            elif q_at_20 >= required_early_q:
                age_cl_20 = 60 if birth_year <= 1969 else (62 if birth_year >= 1970 else 61) # Simplified rules mapping
                options["carriere_longue"] = {"eligible": True, "earliest_age": age_cl_20, "details": f"Éligible départ {age_cl_20} ans ({q_at_20} trimestres validés à la fin de l'année des 20 ans)."}
            elif q_at_21 >= required_early_q:
                options["carriere_longue"] = {"eligible": True, "earliest_age": 63, "details": f"Éligible départ 63 ans ({q_at_21} trimestres validés à la fin de l'année des 21 ans)."}

        return options

    @staticmethod
    def analyze_optimization_options(projected_quarters_at_legal: float, required_quarters: int) -> Dict[str, Any]:
        """Analyzes options to improve the pension (Rachat, Surcote, Cumul, Majorations)."""
        options = {
            "rachat_trimestres": {"eligible": False, "suggested_quarters": 0, "details": "Aucun rachat nécessaire (taux plein atteint)."},
            "surcote": {"eligible": False, "details": "Taux plein non atteint à l'âge légal, la surcote n'est pas applicable."},
            "cumul_emploi_retraite": {"details": "Depuis 2023, le cumul intégral génère de nouveaux droits à retraite (limités à 5% du plafond annuel SS)."},
            "majorations_familiales": {"details": "Rappel : +10% de la pension pour les parents d'au moins 3 enfants."}
        }

        missing_quarters = required_quarters - projected_quarters_at_legal

        if missing_quarters > 0:
            if missing_quarters <= 12:
                options["rachat_trimestres"] = {
                    "eligible": True, 
                    "suggested_quarters": int(missing_quarters),
                    "details": f"Possibilité de racheter jusqu'à {int(missing_quarters)} trimestres (limite légale de 12) pour annuler la décote."
                }
            else:
                options["rachat_trimestres"] = {
                    "eligible": True,
                    "suggested_quarters": 12,
                    "details": "Possibilité de racheter 12 trimestres (le maximum légal) pour réduire partiellement la décote."
                }
        else:
            # Surcote eligible
            options["surcote"] = {
                "eligible": True,
                "details": "Taux plein validé. Chaque trimestre entier cotisé en prolongeant l'activité au-delà de l'âge légal rapportera 1,25% de majoration."
            }

        return options

    @staticmethod
    def project_future_career(total_points: float, birth_year: int, current_salary: float, current_quarters: int = 0, birth_month: int = 1, career_data: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Expert career projection based on birth year and 2023 Reform."""
        params = RetirementRulesEngine.get_generation_parameters(birth_year, birth_month)
        legal_age = float(params["legal_age_years"]) + (float(params["legal_age_months"]) / 12.0)
        required_q = params["required_quarters"]
        
        current_year = datetime.now().year
        current_age = current_year - birth_year
        
        years_to_legal = max(0.0, legal_age - current_age)
        
        # Points calculation
        calc_res = RetirementRulesEngine.calculate_theoretical_points(current_salary, 2025)
        annual_points = float(calc_res.get("points", 0.0))
        
        projected_points_at_legal = total_points + (annual_points * years_to_legal)
        
        # Quarters estimation at legal age
        projected_quarters_at_legal = current_quarters + int(years_to_legal * 4)
        
        has_full_rate = projected_quarters_at_legal >= required_q
        
        data_2025 = RETIREMENT_RESOURCES.get(2025)
        service_val = 1.4386
        if isinstance(data_2025, dict) and "unified" in data_2025:
             service_val = float(data_2025["unified"].get("service", 1.4386))
             
        estimated_annual_pension = projected_points_at_legal * service_val
        
        # Apply minoration if not full rate (approx 1.25% per missing quarter)
        malus = 1.0
        if not has_full_rate:
            missing_q = min(20, required_q - projected_quarters_at_legal) # Cap at 20 quarters
            malus = max(0.75, 1.0 - (missing_q * 0.0125)) 
            estimated_annual_pension *= malus

        early_options = RetirementRulesEngine.analyze_early_retirement_options(current_quarters, birth_year, birth_month, career_data)
        optimization_opts = RetirementRulesEngine.analyze_optimization_options(projected_quarters_at_legal, required_q)

        return {
            "birth_year": birth_year,
            "legal_age_display": f"{params['legal_age_years']} ans" + (f" et {params['legal_age_months']} mois" if params['legal_age_months'] > 0 else ""),
            "required_quarters": required_q,
            "projected_quarters": projected_quarters_at_legal,
            "has_full_rate": has_full_rate,
            "years_to_retirement": round(float(years_to_legal), 1),
            "projected_points": round(float(projected_points_at_legal), 2),
            "estimated_monthly_pension": round(float(estimated_annual_pension / 12.0), 2),
            "malus_applied": round(float((1.0 - malus) * 100), 1),
            "early_retirement_options": early_options,
            "optimization_options": optimization_opts
        }

    @staticmethod
    def calculate_base_pension(sam: float, validated_quarters: int, required_quarters: int, rate: float = 0.5) -> float:
        """
        Calculates base pension: SAM * rate * (validated / required).
        User formula: pension = SAM × taux × (trimestres validés / trimestres requis)
        """
        if required_quarters <= 0: return 0.0
        ratio = min(1.0, float(validated_quarters) / float(required_quarters))
        return sam * rate * ratio

    @staticmethod
    def calculate_complementary_pension(total_points: float, service_value: float) -> float:
        """
        Calculates complementary pension: points * service_value.
        User formula: pension complémentaire = total des points × valeur du point.
        """
        return total_points * service_value

    @staticmethod
    def calculate_sam(career_data: List[Dict[str, Any]]) -> float:
        """
        Calculates the Average Annual Salary (SAM) based on the 25 best years.
        Only years with salary > 0 are considered.
        """
        salaries = [float(item.get("salary", 0.0)) for item in career_data if float(item.get("salary", 0.0)) > 0]
        if not salaries: return 0.0
        salaries.sort(reverse=True)
        # Take up to 25 best years
        end_idx = min(25, len(salaries))
        best_25 = [salaries[i] for i in range(end_idx)]
        return sum(best_25) / len(best_25)
