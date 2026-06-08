FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ /app/

# /data is persisted by Home Assistant across restarts and updates
ENV DB_PATH=/data/beikost.db

EXPOSE 8099
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8099"]
