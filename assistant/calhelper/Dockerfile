FROM python:3.12-slim
RUN pip install --no-cache-dir caldav==1.4.0
COPY calhelper.py /app/calhelper.py
CMD ["python", "-u", "/app/calhelper.py"]
