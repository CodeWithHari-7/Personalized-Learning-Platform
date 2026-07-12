from typing import Dict, Any

# Main exchange rates mapping base USD to target currency
EXCHANGE_RATES = {
    "USD": 1.0,
    "INR": 83.0,
    "GBP": 0.79,
    "EUR": 0.92,
    "JPY": 155.0,
    "CAD": 1.37,
    "AUD": 1.51
}

CURRENCY_METADATA = {
    "USD": {"symbol": "$", "name": "US Dollar"},
    "INR": {"symbol": "₹", "name": "Indian Rupee"},
    "GBP": {"symbol": "£", "name": "British Pound"},
    "EUR": {"symbol": "€", "name": "Euro"},
    "JPY": {"symbol": "¥", "name": "Japanese Yen"},
    "CAD": {"symbol": "CA$", "name": "Canadian Dollar"},
    "AUD": {"symbol": "A$", "name": "Australian Dollar"}
}

# Country to currency mapping
COUNTRY_CURRENCY_MAP = {
    "india": "INR",
    "in": "INR",
    "united states": "USD",
    "us": "USD",
    "usa": "USD",
    "united kingdom": "GBP",
    "uk": "GBP",
    "japan": "JPY",
    "jp": "JPY",
    "germany": "EUR",
    "france": "EUR",
    "italy": "EUR",
    "spain": "EUR",
    "netherlands": "EUR",
    "eu": "EUR",
    "canada": "CAD",
    "ca": "CAD",
    "australia": "AUD",
    "au": "AUD"
}

def get_currency_for_country(country: str) -> str:
    if not country:
        return "USD"
    c_clean = country.strip().lower()
    return COUNTRY_CURRENCY_MAP.get(c_clean, "USD")

def convert_usd_salary(amount_usd: float, country: str) -> Dict[str, Any]:
    """
    Converts USD salary to country currency and returns formatting metadata.
    """
    currency_code = get_currency_for_country(country)
    rate = EXCHANGE_RATES.get(currency_code, 1.0)
    converted_value = amount_usd * rate
    meta = CURRENCY_METADATA.get(currency_code, {"symbol": "$", "name": "US Dollar"})
    
    return {
        "value": round(converted_value),
        "currency_code": currency_code,
        "symbol": meta["symbol"],
        "is_estimate": currency_code != "USD",
        "rate": rate
    }
