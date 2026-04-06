FROM python:3.11-slim
WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl && \
    rm -rf /var/lib/apt/lists/*

# Poetry setup
RUN pip install poetry && \
    poetry config virtualenvs.create false

# Step 1: Heavy Dependencies (Cached)
COPY pyproject.toml poetry.lock* LICENSE-PYTHON README.md ./
RUN poetry install --all-extras --with dev --no-interaction --no-ansi --no-root

# Step 2: Your Code
COPY . .

# Step 3: Fast metadata install (to enable 'fabric' command)
RUN poetry install --all-extras --with dev --no-interaction --no-ansi