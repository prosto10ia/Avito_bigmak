import re

SECRET_PATTERNS = (
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
    r"AKIA[0-9A-Z]{16}",
    r"ghp_[A-Za-z0-9]{36}",
    r"avito_secret_[a-zA-Z0-9]+",
)


def validate_no_secrets(value: object) -> bool:
    text = value if isinstance(value, str) else repr(value)
    return not any(re.search(pattern, text) for pattern in SECRET_PATTERNS)
