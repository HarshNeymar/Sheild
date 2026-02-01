# Step 1: Build the React frontend
FROM node:20-slim AS build-step
WORKDIR /app

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the code and build the production assets
COPY . .
RUN npm run build

# Step 2: Set up the production server
FROM node:20-slim
WORKDIR /app

# Only install production dependencies for the server
COPY package*.json ./
RUN npm install --only=production

# Copy the built files from the 'build-step' and the server script
COPY --from=build-step /app/dist ./dist
COPY server.js ./

# Cloud Run injects the PORT environment variable (usually 8080)
ENV PORT=8080
EXPOSE 8080

# Start the Node.js server
CMD ["node", "server.js"]
