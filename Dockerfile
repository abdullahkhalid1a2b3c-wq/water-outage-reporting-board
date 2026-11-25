FROM php:8.5-cli

# Ensure pdo_sqlite is available
RUN php -m | grep -qi pdo_sqlite || ( \
    apt-get update && \
    apt-get install -y --no-install-recommends libsqlite3-dev && \
    docker-php-ext-install pdo_sqlite && \
    rm -rf /var/lib/apt/lists/* \
)

WORKDIR /app
COPY . /app

ENV PORT=8000
EXPOSE 8000

# Re-seed on every start so ephemeral free-tier storage always starts with demo data
CMD ["sh", "-c", "php database/seed.php && php -S 0.0.0.0:${PORT:-8000} -t public"]
