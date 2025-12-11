import logging

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


# Configure logger
formatter = CustomColorFormatter(
    fmt="%(asctime)s - %(levelname)s: %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
)

handler = logging.StreamHandler()
handler.setFormatter(formatter)

logging.root.handlers.clear()
logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)

logThis = logging.getLogger(__name__)
