import logging
from pathlib import Path

from utils.env_config import load_env

# Define ANSI color codes
COLOR_CODES = {
    "red": "\033[91m",
    "green": "\033[92m",
    "yellow": "\033[93m",
    "blue": "\033[94m",
    "magenta": "\033[95m",
    "cyan": "\033[96m",
    "white": "\033[97m",
    "reset": "\033[0m",
    "default": "",  # No color
}


class CustomColorFormatter(logging.Formatter):
    def format(self, record):
        # Default to white or no color unless 'color' key is present in extra
        color = COLOR_CODES.get(getattr(record, "color", "default"), "")
        reset = COLOR_CODES["reset"]

        record.levelname = f"{color}{record.levelname}{reset}"
        record.msg = f"{color}{record.msg}{reset}"

        return super().format(record)


def get_production_config_logger(env: str) -> logging.Logger:
    logger = logging.getLogger("production_config")
    logger.propagate = False  # prevent root duplication
    logger.handlers.clear()  # avoid stacking handlers
    logger.setLevel(logging.INFO)
    handler: logging.Handler

    if env == "development":
        handler = logging.StreamHandler()
    else:
        BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
        LOG_FILE = BASE_DIR / "log.txt"
        handler = logging.FileHandler(LOG_FILE, mode="w")

    formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
    handler.setFormatter(formatter)

    logger.addHandler(handler)

    return logger


logThis = get_production_config_logger(load_env())
