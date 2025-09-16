import logging


class EmojiFormatter(logging.Formatter):
    EMOJIS = {
        logging.DEBUG: "🐛 ",
        logging.INFO: "ℹ️ ",
        logging.WARNING: "⚠️ ",
        logging.ERROR: "❌ ",
        logging.CRITICAL: "🔥  ",
    }

    def format(self, record):
        emoji = self.EMOJIS.get(record.levelno, "")
        record.levelname = f"{emoji} {record.levelname}"
        return super().format(record)


def get_logger(name: str) -> logging.Logger:
    handler = logging.StreamHandler()
    handler.setFormatter(EmojiFormatter("%(levelname)s:%(name)s:%(message)s"))

    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    # prevent duplicate handlers if reused
    if not logger.handlers:
        logger.addHandler(handler)

    return logger
