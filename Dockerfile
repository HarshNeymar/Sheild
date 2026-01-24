# 1. Use an official lightweight Python image
FROM python:3.10-slim

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. Copy the rest of your application code
COPY . .

# 5. Expose the port (Cloud Run defaults to 8080)
ENV PORT 8080

# 6. Run the application
# CHANGE "main:app" to match your actual filename (e.g., if your file is app.py, use app:app)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
