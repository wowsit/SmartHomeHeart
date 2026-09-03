FROM python:3.12-slim
RUN pip install --no-cache-dir wyoming==1.6.1
COPY groq_stt.py /app/groq_stt.py
CMD ["python", "-u", "/app/groq_stt.py"]
