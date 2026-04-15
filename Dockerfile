ARG BUILD_FROM=ghcr.io/home-assistant/base-python:3.12-alpine3.23
FROM ${BUILD_FROM}

# Python runtime settings
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install Python deps first (cached layer)
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip3 install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend source
COPY backend/ /app/backend/

# Copy pre-built frontend assets (frontend is built on the host; see Open Question 2 in RESEARCH.md)
COPY frontend/dist/ /app/frontend/dist/

# Entry script
COPY run.sh /run.sh
RUN chmod +x /run.sh

EXPOSE 8099

CMD ["/run.sh"]
