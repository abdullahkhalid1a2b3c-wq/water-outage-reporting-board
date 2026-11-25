FROM php:8.5-cli

# Install system dependencies and enable pdo_sqlite and mbstring
RUN apt-get update && \
    apt-get install -y --no-install-recommends libsqlite3-dev libonig-dev && \
    docker-php-ext-install pdo_sqlite mbstring && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . /app

ENV PORT=8000
EXPOSE 8000

# Seed SQLite on every boot (ephemeral free-tier disk) and listen on Render's dynamic $PORT
CMD ["sh", "-c", "php database/seed.php && php -S 0.0.0.0:${PORT:-8000} -t public"]
