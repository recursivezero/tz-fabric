FROM node:22-slim

WORKDIR /app

# 1. Install dependencies (Cached layer)
# Using 'ci' instead of 'install' is a best practice for production/Docker 
# as it ensures a clean install based strictly on your package-lock.json
COPY package*.json ./
RUN npm install

# 2. Copy the rest of your code
COPY . .

# 3. Inform Docker which port the app uses
EXPOSE 5173 

# Note: We do not put a CMD here because we handle it in docker-compose.yml