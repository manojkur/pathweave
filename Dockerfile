FROM python:3.13-slim
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN pip install --no-cache-dir uv && uv sync --frozen --no-dev
COPY learninglab ./learninglab
RUN useradd --uid 10001 --create-home learner && mkdir /data && chown learner:learner /data
USER learner
ENV DATA_DIR=/data PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD ["/app/.venv/bin/python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
CMD ["/app/.venv/bin/uvicorn", "learninglab.app:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]

