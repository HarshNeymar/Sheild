# Use Node 20 (Lightweight)
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files first to leverage Docker caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app code
COPY . .

# Build the frontend (creates the 'dist' folder)
RUN npm run build

# Expose the port Cloud Run needs
ENV PORT 8080

# Start the server
CMD ["npm", "start"]
